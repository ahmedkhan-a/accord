import json
import logging
import secrets
from datetime import date
from decimal import Decimal, InvalidOperation
from functools import wraps

from django.conf import settings
from django.core.mail import send_mail

from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from . import workflow as wf
from .models import Agreement, AgreementHistory, Signature
from .pdf import build_pdf

logger = logging.getLogger(__name__)

ALLOWED_ORIGIN = "http://localhost:5173"


# =========================
# INFRASTRUCTURE
# =========================

class ApiError(Exception):
    def __init__(self, status, message, errors=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.errors = errors or {}


def add_cors(response):
    response["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    response["Access-Control-Allow-Credentials"] = "true"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response["Access-Control-Expose-Headers"] = "Content-Disposition"
    return response


def json_response(data, status=200):
    return add_cors(JsonResponse(data, status=status, safe=isinstance(data, dict)))


def api(methods, auth=True):
    """CORS + method check + auth check + consistent JSON errors."""
    def decorator(view):
        @csrf_exempt
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            try:
                if request.method == "OPTIONS":
                    return add_cors(JsonResponse({}))
                if request.method not in methods:
                    raise ApiError(405, "Method not allowed.")
                if auth and not request.user.is_authenticated:
                    raise ApiError(401, "Authentication required.")
                if (request.method in ("POST", "PUT", "PATCH") and request.body
                        and request.content_type != "application/json"):
                    raise ApiError(415, "Content-Type must be application/json.")
                return view(request, *args, **kwargs)
            except ApiError as exc:
                body = {"error": exc.message}
                if exc.errors:
                    body["errors"] = exc.errors
                return json_response(body, exc.status)
            except Exception:
                logger.exception("Unhandled error in %s", view.__name__)
                return json_response({"error": "Something went wrong on the server."}, 500)
        return wrapper
    return decorator


def parse_body(request):
    if not request.body:
        return {}
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise ApiError(400, "Request body must be valid JSON.")
    if not isinstance(data, dict):
        raise ApiError(400, "Request body must be a JSON object.")
    return data


def client_ip(request):
    # REMOTE_ADDR only: X-Forwarded-For is spoofable unless you run behind a trusted proxy.
    return request.META.get("REMOTE_ADDR") or None


def iso(value):
    return value.isoformat() if value else None


# =========================
# VALIDATION
# =========================

TEXT_LIMITS = {
    "title": 200, "agreement_type": 100, "counterpart": 200, "party_one_name": 200,
    "description": 5000, "content": 50000, "scope_of_work": 10000,
    "payment_terms": 10000, "delivery_terms": 10000, "responsibilities": 10000,
    "cancellation_terms": 10000, "additional_terms": 10000, "currency": 3,
}
EMAIL_FIELDS = ("party_one_email", "party_two_email")
DATE_FIELDS = ("due_date", "start_date", "end_date")


def clean_agreement_data(data, partial, existing=None):
    data = dict(data)
    if "party_two_name" in data and "counterpart" not in data:
        data["counterpart"] = data["party_two_name"]

    values, errors = {}, {}

    for field, limit in TEXT_LIMITS.items():
        if field in data:
            value = "" if data[field] is None else str(data[field]).strip()
            if len(value) > limit:
                errors[field] = f"Must be {limit} characters or fewer."
            else:
                values[field] = value

    if "currency" in values:
        code = values["currency"].upper()
        if len(code) != 3 or not code.isalpha():
            errors["currency"] = "Use a 3-letter currency code, e.g. USD."
        else:
            values["currency"] = code

    for field in EMAIL_FIELDS:
        if field in data:
            value = str(data[field] or "").strip().lower()
            if value:
                try:
                    validate_email(value)
                except ValidationError:
                    errors[field] = "Enter a valid email address."
                    continue
            values[field] = value

    for field in DATE_FIELDS:
        if field in data:
            if data[field] in (None, ""):
                values[field] = None
            else:
                try:
                    values[field] = date.fromisoformat(str(data[field]))
                except ValueError:
                    errors[field] = "Use the format YYYY-MM-DD."

    if "payment_amount" in data:
        if data["payment_amount"] in (None, ""):
            values["payment_amount"] = None
        else:
            try:
                amount = Decimal(str(data["payment_amount"]))
                if not amount.is_finite() or amount < 0 or amount >= Decimal("10000000000"):
                    raise InvalidOperation
                values["payment_amount"] = amount.quantize(Decimal("0.01"))
            except InvalidOperation:
                errors["payment_amount"] = "Enter a valid, non-negative amount."

    for field, message in (("title", "Agreement title is required."),
                           ("counterpart", "Counterpart is required.")):
        if (not partial or field in values) and not values.get(field):
            errors.setdefault(field, message)

    start = values.get("start_date", existing.start_date if existing else None)
    end = values.get("end_date", existing.end_date if existing else None)
    if start and end and end < start:
        errors["end_date"] = "End date must be on or after the start date."

    if errors:
        raise ApiError(400, next(iter(errors.values())), errors)
    return values


def clean_signing_input(data):
    name = str(data.get("signed_name", "")).strip()
    if len(name) < 2 or len(name) > 200:
        raise ApiError(400, "Type your full name to sign.", {"signed_name": "Type your full name."})
    if data.get("consent") is not True:
        raise ApiError(400, "Please confirm you agree to sign electronically.",
                       {"consent": "Confirmation required."})
    return name


# =========================
# SERIALIZERS
# =========================

CONTENT_FIELDS = (
    "description", "content", "scope_of_work", "payment_terms", "delivery_terms",
    "responsibilities", "cancellation_terms", "additional_terms",
)


def current_status(a):
    return wf.normalize_status(a.status)


def money(a):
    return str(a.payment_amount) if a.payment_amount is not None else None


def agreement_to_dict(a):
    """Summary (list/cards). Keeps every key the old frontend used."""
    return {
        "id": a.id,
        "reference": a.reference,
        "title": a.title,
        "agreement_type": a.agreement_type,
        "counterpart": a.counterpart,
        "party_two_name": a.counterpart,
        "party_two_email": a.party_two_email,
        "status": current_status(a),
        "due_date": iso(a.due_date),
        "payment_amount": money(a),
        "currency": a.currency,
        "created_at": iso(a.created_at),
        "updated_at": iso(a.updated_at),
        "sent_at": iso(a.sent_at),
        "signed_at": iso(a.signed_at),
    }


def signature_to_dict(s, owner_view):
    data = {"role": s.role, "signed_name": s.signed_name, "signed_at": iso(s.signed_at)}
    if owner_view:
        data["signer_email"] = s.signer_email
    return data


def history_to_dict(h):
    if h.user:
        actor = h.user.first_name or h.user.username
    else:
        actor = h.metadata.get("by", "System")
    return {
        "id": h.id,
        "event_type": h.event_type,
        "label": h.event_type.replace("_", " ").capitalize(),
        "actor": actor,
        "metadata": h.metadata,
        "created_at": iso(h.created_at),
    }


def owner_actions(a, roles):
    s = current_status(a)
    actions = ["pdf"]
    if s in wf.EDITABLE:
        actions += ["edit", "send"]
    if s in wf.PENDING or s == wf.SIGNED:
        actions.append("share")
    if s in wf.SIGNABLE and "party_one" not in roles:
        actions.append("sign")
    if s in (wf.REJECTED, wf.EXPIRED):
        actions.append("reopen")
    if s != wf.SIGNED:
        actions.append("delete")
    return actions


def agreement_to_detail(a):
    signatures = list(a.signatures.all())
    data = agreement_to_dict(a)
    data.update({field: getattr(a, field) for field in CONTENT_FIELDS})
    data.update({
        "party_one_name": a.party_one_name,
        "party_one_email": a.party_one_email,
        "start_date": iso(a.start_date),
        "end_date": iso(a.end_date),
        "viewed_at": iso(a.viewed_at),
        "rejected_at": iso(a.rejected_at),
        "rejection_reason": a.rejection_reason,
        "share_path": f"/agreement/share/{a.share_token}" if a.share_token else None,
        "signatures": [signature_to_dict(s, True) for s in signatures],
        "available_actions": owner_actions(a, {s.role for s in signatures}),
        "history": [history_to_dict(h) for h in a.history.select_related("user")[:50]],
    })
    return data


def shared_to_dict(a, is_owner=False):
    """Public view for the counterparty. No owner id, no history, no other agreements."""
    signatures = list(a.signatures.all())
    roles = {s.role for s in signatures}
    s = current_status(a)
    actions = ["pdf"]
    if not is_owner:
        if s == wf.VIEWED:
            actions.append("continue")
        if s in (wf.VIEWED, wf.IN_REVIEW):
            actions.append("accept")
        if s in wf.SIGNABLE and "party_two" not in roles:
            actions.append("sign")
        if s in wf.REJECTABLE:
            actions.append("reject")
    return {
        "reference": a.reference,
        "title": a.title,
        "agreement_type": a.agreement_type,
        "status": s,
        "party_one_name": a.party_one_name,
        "party_one_email": a.party_one_email,
        "party_two_name": a.counterpart,
        "party_two_email": a.party_two_email,
        **{field: getattr(a, field) for field in CONTENT_FIELDS},
        "payment_amount": money(a),
        "currency": a.currency,
        "start_date": iso(a.start_date),
        "end_date": iso(a.end_date),
        "due_date": iso(a.due_date),
        "created_at": iso(a.created_at),
        "updated_at": iso(a.updated_at),
        "sent_at": iso(a.sent_at),
        "signed_at": iso(a.signed_at),
        "rejection_reason": a.rejection_reason if s == wf.REJECTED else "",
        "signatures": [signature_to_dict(x, False) for x in signatures],
        "available_actions": actions,
        "is_owner_preview": is_owner,
    }


# =========================
# DOMAIN HELPERS
# =========================

def log(agreement, event, user=None, **meta):
    AgreementHistory.objects.create(
        agreement=agreement,
        event_type=event,
        user=user if getattr(user, "is_authenticated", False) else None,
        metadata=meta,
    )


def move(a, new_status):
    current = current_status(a)
    if not wf.can_transition(current, new_status):
        raise ApiError(409, f"Can't change status from {current} to {new_status}.")
    a.status = new_status


def refresh_expiry(a):
    """Pending agreements past their due date become Expired."""
    if current_status(a) in wf.PENDING and a.due_date and a.due_date < timezone.localdate():
        previous = current_status(a)
        a.status = wf.EXPIRED
        a.save(update_fields=["status", "updated_at"])
        log(a, "expired", previous_status=previous, by="System")


def get_owned(request, agreement_id):
    # Same 404 for "missing" and "someone else's": IDs can't be probed.
    try:
        return Agreement.objects.get(id=agreement_id, owner=request.user)
    except Agreement.DoesNotExist:
        raise ApiError(404, "Agreement not found.")


def get_shared(token):
    not_found = ApiError(404, "This link is invalid or no longer available.")
    if len(token) > 64:
        raise not_found
    try:
        a = Agreement.objects.get(share_token=token)
    except Agreement.DoesNotExist:
        raise not_found
    if current_status(a) == wf.DRAFT:
        raise not_found
    refresh_expiry(a)
    return a


def forbid_owner(request, a):
    if request.user.is_authenticated and a.owner_id == request.user.id:
        raise ApiError(403, "You can't act as the counterparty on your own agreement.")


def new_token():
    return secrets.token_urlsafe(32)
def notify(subject, body, to):
    recipients = [x for x in to if x]
    if not recipients:
        return
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients)
    except Exception:
        logger.exception("Could not send email")


def share_url(a):
    return f"{settings.FRONTEND_URL}/agreement/share/{a.share_token}"


@transaction.atomic
def add_signature(agreement, role, name, email, user, ip):
    a = Agreement.objects.select_for_update().get(pk=agreement.pk)
    if current_status(a) not in wf.SIGNABLE:
        raise ApiError(409, "This agreement isn't open for signing.")
    if a.signatures.filter(role=role).exists():
        raise ApiError(409, "This party has already signed.")

    Signature.objects.create(
        agreement=a, role=role, signed_name=name, signer_email=email,
        user=user if getattr(user, "is_authenticated", False) else None, ip_address=ip,
    )
    by = {"by": "Counterparty"} if role == "party_two" else {}
    log(a, "signature_added", user=user, role=role, signed_name=name, **by)

    if a.signatures.count() >= 2:
        move(a, wf.SIGNED)
        a.signed_at = timezone.now()
        log(a, "fully_signed", by="System")
    else:
        move(a, wf.PARTIAL)
    a.save()
    if current_status(a) == wf.SIGNED:
        transaction.on_commit(lambda: notify(
            f"Fully signed: {a.title}",
            f"Both parties have signed \"{a.title}\" ({a.reference}).\n"
            "You can download the PDF from Accord.\n\n- Accord",
            [a.party_one_email, a.party_two_email],
        ))
    return a


def pdf_response(a):
    data = build_pdf(a, list(a.signatures.order_by("signed_at")))
    response = HttpResponse(data, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{a.reference}.pdf"'
    return add_cors(response)


# =========================
# AUTH
# =========================

def user_to_dict(user):
    return {"id": user.id, "username": user.username, "email": user.email, "name": user.first_name}


@api(("POST",), auth=False)
def register(request):
    data = parse_body(request)
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    if not name or not email or not password:
        raise ApiError(400, "Name, email and password are required.")
    if len(name) > 150 or len(email) > 150:
        raise ApiError(400, "Name and email must be 150 characters or fewer.")
    try:
        validate_email(email)
    except ValidationError:
        raise ApiError(400, "Enter a valid email address.")
    if User.objects.filter(username__iexact=email).exists():
        raise ApiError(400, "An account with this email already exists.")
    try:
        validate_password(password, user=User(username=email, email=email, first_name=name))
    except ValidationError as exc:
        raise ApiError(400, " ".join(exc.messages))

    user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
    login(request, user)
    return json_response({"message": "Registration successful.", "user": user_to_dict(user)}, 201)


@api(("POST",), auth=False)
def user_login(request):
    data = parse_body(request)
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))

    user = authenticate(request, username=email, password=password)
    if user is None:
        raise ApiError(401, "Invalid email or password.")
    login(request, user)
    return json_response({"message": "Login successful.", "user": user_to_dict(user)})


@api(("GET", "POST"), auth=False)  # GET kept so the existing frontend keeps working
def user_logout(request):
    logout(request)
    return json_response({"message": "Logged out successfully."})


@api(("GET",), auth=False)
def current_user(request):
    if not request.user.is_authenticated:
        return json_response({"authenticated": False, "user": None})
    return json_response({"authenticated": True, "user": user_to_dict(request.user)})


# =========================
# OWNER: AGREEMENTS CRUD
# =========================

@api(("GET", "POST"))
def agreements(request):
    if request.method == "GET":
        items = list(Agreement.objects.filter(owner=request.user).order_by("-created_at"))
        for a in items:
            refresh_expiry(a)
        return json_response([agreement_to_dict(a) for a in items])

    values = clean_agreement_data(parse_body(request), partial=False)
    if not values.get("party_one_name"):
        values["party_one_name"] = request.user.first_name
    if not values.get("party_one_email"):
        values["party_one_email"] = request.user.email

    # Status is controlled by the workflow; clients can't choose it.
    a = Agreement.objects.create(owner=request.user, status=wf.DRAFT, **values)
    log(a, "created", user=request.user)
    return json_response(agreement_to_detail(a), 201)


@api(("GET", "PUT", "PATCH", "DELETE"))
def agreement_detail(request, agreement_id):
    a = get_owned(request, agreement_id)
    refresh_expiry(a)

    if request.method == "GET":
        return json_response(agreement_to_detail(a))

    if request.method == "DELETE":
        if current_status(a) == wf.SIGNED:
            raise ApiError(409, "Signed agreements can't be deleted.")
        a.delete()
        return json_response({"message": "Agreement deleted successfully."})

    if current_status(a) not in wf.EDITABLE:
        raise ApiError(409, f"A {current_status(a)} agreement can't be edited.")

    values = clean_agreement_data(parse_body(request), partial=True, existing=a)
    changed = [k for k, v in values.items() if getattr(a, k) != v]
    for key, value in values.items():
        setattr(a, key, value)
    a.save()
    if changed:
        log(a, "edited", user=request.user, fields=changed)
    return json_response(agreement_to_detail(a))


# =========================
# OWNER: WORKFLOW ACTIONS
# =========================

@api(("POST",))
def agreement_send(request, agreement_id):
    a = get_owned(request, agreement_id)
    refresh_expiry(a)
    move(a, wf.SENT)  # 409 unless Draft

    errors = {}
    if not a.counterpart.strip():
        errors["counterpart"] = "Counterparty name is required before sending."
    if not a.party_two_email:
        errors["party_two_email"] = "Counterparty email is required before sending."
    if not (a.content.strip() or a.scope_of_work.strip()):
        errors["content"] = "Add agreement content or scope of work before sending."
    if a.due_date and a.due_date < timezone.localdate():
        errors["due_date"] = "Due date is in the past."
    if errors:
        raise ApiError(400, next(iter(errors.values())), errors)

    a.sent_at = timezone.now()
    a.viewed_at = a.rejected_at = None
    a.rejection_reason = ""
    if not a.share_token:
        a.share_token = new_token()
    a.save()
    log(a, "sent", user=request.user, to=a.party_two_email)
        
    notify(
        f"{a.party_one_name or 'Someone'} sent you an agreement: {a.title}",
        f"Hello {a.counterpart},\n\n"
        f"{a.party_one_name or 'A user'} has sent you an agreement to review and sign:\n"
        f"{a.title}\n\nOpen it here:\n{share_url(a)}\n\n- Accord",
        [a.party_two_email],
    )

    return json_response(agreement_to_detail(a))


@api(("POST",))
def agreement_share(request, agreement_id):
    a = get_owned(request, agreement_id)
    data = parse_body(request)
    regenerate = data.get("regenerate") is True
    if regenerate or not a.share_token:
        event = "share_link_regenerated" if a.share_token else "share_link_created"
        a.share_token = new_token()
        a.save(update_fields=["share_token", "updated_at"])
        log(a, event, user=request.user)
    return json_response({
        "share_path": f"/agreement/share/{a.share_token}",
        "live": current_status(a) != wf.DRAFT,  # link only works after sending
    })


@api(("POST",))
def agreement_sign(request, agreement_id):
    a = get_owned(request, agreement_id)
    refresh_expiry(a)
    name = clean_signing_input(parse_body(request))
    a = add_signature(
        a, "party_one", name, a.party_one_email or request.user.email,
        request.user, client_ip(request),
    )
    return json_response(agreement_to_detail(a))


@api(("POST",))
def agreement_reopen(request, agreement_id):
    a = get_owned(request, agreement_id)
    refresh_expiry(a)
    previous = current_status(a)
    move(a, wf.DRAFT)
    removed = a.signatures.count()
    a.signatures.all().delete()
    a.share_token = None  # old link stops working
    a.sent_at = a.viewed_at = a.signed_at = a.rejected_at = None
    a.rejection_reason = ""
    a.save()
    log(a, "reopened", user=request.user, previous_status=previous, signatures_removed=removed)
    return json_response(agreement_to_detail(a))


@api(("GET",))
def agreement_history(request, agreement_id):
    a = get_owned(request, agreement_id)
    return json_response([history_to_dict(h) for h in a.history.select_related("user")])


@api(("GET",))
def agreement_pdf(request, agreement_id):
    a = get_owned(request, agreement_id)
    log(a, "pdf_generated", user=request.user)
    return pdf_response(a)


# =========================
# COUNTERPARTY (token only, no login)
# =========================

@api(("GET",), auth=False)
def shared_agreement(request, token):
    a = get_shared(token)
    is_owner = request.user.is_authenticated and a.owner_id == request.user.id
    if not is_owner and current_status(a) == wf.SENT:
        move(a, wf.VIEWED)
        a.viewed_at = timezone.now()
        a.save()
        log(a, "viewed", by="Counterparty")
    return json_response(shared_to_dict(a, is_owner))


@api(("POST",), auth=False)
def shared_respond(request, token):
    a = get_shared(token)
    forbid_owner(request, a)
    action = str(parse_body(request).get("action", "")).strip().lower()
    if action == "continue":
        move(a, wf.IN_REVIEW)
        event = "in_review"
    elif action == "accept":
        move(a, wf.AWAITING)
        event = "accepted"
    else:
        raise ApiError(400, "Action must be 'continue' or 'accept'.")
    a.save()
    log(a, event, by="Counterparty")
    return json_response(shared_to_dict(a))


@api(("POST",), auth=False)
def shared_sign(request, token):
    a = get_shared(token)
    forbid_owner(request, a)
    data = parse_body(request)
    name = clean_signing_input(data)

    email = str(data.get("signer_email", "")).strip().lower()
    try:
        validate_email(email)
    except ValidationError:
        raise ApiError(400, "Enter a valid email address.", {"signer_email": "Enter a valid email address."})
    if a.party_two_email and email != a.party_two_email.lower():
        raise ApiError(400, "That email doesn't match the invited counterparty.",
                       {"signer_email": "Doesn't match the invited email."})

    a = add_signature(a, "party_two", name, email, None, client_ip(request))
    return json_response(shared_to_dict(a))


@api(("POST",), auth=False)
def shared_reject(request, token):
    a = get_shared(token)
    forbid_owner(request, a)
    reason = str(parse_body(request).get("reason", "")).strip()
    if len(reason) > 2000:
        raise ApiError(400, "Reason must be 2000 characters or fewer.")
    move(a, wf.REJECTED)
    a.rejected_at = timezone.now()
    a.rejection_reason = reason
    a.save()
    log(a, "rejected", by="Counterparty", reason=reason)
    notify(
        f"Agreement rejected: {a.title}",
        f"{a.counterpart} rejected your agreement.\nReason: {reason or 'No reason given'}\n\n- Accord",
        [a.owner.email if a.owner else a.party_one_email],
    )
    return json_response(shared_to_dict(a))


@api(("GET",), auth=False)
def shared_pdf(request, token):
    a = get_shared(token)
    log(a, "pdf_generated", user=request.user, by="Counterparty")
    return pdf_response(a)

# =========================
# PASSWORD RESET
# =========================

@api(("POST",), auth=False)
def password_forgot(request):
    email = str(parse_body(request).get("email", "")).strip().lower()
    user = User.objects.filter(username__iexact=email).first()
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        notify(
            "Reset your Accord password",
            f"Hello {user.first_name},\n\nReset your password here:\n"
            f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}\n\n"
            "If you did not ask for this, ignore this email.\n\n- Accord",
            [user.email],
        )
    # Same answer whether or not the email exists.
    return json_response({"message": "If that email exists, a reset link has been sent."})


@api(("POST",), auth=False)
def password_reset(request):
    data = parse_body(request)
    invalid = ApiError(400, "This reset link is invalid or has expired.")
    try:
        user = User.objects.get(pk=urlsafe_base64_decode(str(data.get("uid", ""))).decode())
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        raise invalid
    if not default_token_generator.check_token(user, str(data.get("token", ""))):
        raise invalid
    password = str(data.get("password", ""))
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        raise ApiError(400, " ".join(exc.messages))
    user.set_password(password)
    user.save()
    return json_response({"message": "Password updated. You can log in now."})