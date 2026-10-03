from datetime import timezone as dtz
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from . import workflow as wf

APP_NAME = "Accord"
INK = colors.HexColor("#2a2420")
MUTED = colors.HexColor("#8a8178")
RULE = colors.HexColor("#e4ddd3")
ROLES = {"party_one": "Party 1", "party_two": "Party 2"}


def _dt(value):
    return value.astimezone(dtz.utc).strftime("%d %b %Y, %H:%M UTC") if value else "-"


def _d(value):
    return value.strftime("%d %b %Y") if value else "-"


def build_pdf(a, signatures):
    buf = BytesIO()
    base = getSampleStyleSheet()["BodyText"]
    body = ParagraphStyle("body", parent=base, fontName="Helvetica", fontSize=10, leading=14.5, textColor=INK)
    small = ParagraphStyle("small", parent=body, fontSize=8.5, leading=12, textColor=MUTED)
    label = ParagraphStyle("label", parent=small, fontName="Helvetica-Bold")
    brand = ParagraphStyle("brand", parent=body, fontName="Helvetica-Bold", fontSize=11, textColor=MUTED)
    title = ParagraphStyle("title", parent=body, fontName="Helvetica-Bold", fontSize=22, leading=26, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=body, fontName="Helvetica-Bold", fontSize=12, spaceBefore=14, spaceAfter=4)

    def para(text, style=body):
        safe = escape(str(text or "")).replace("\n", "<br/>")
        return Paragraph(safe or "-", style)

    def kv(rows):
        table = Table([[para(k, label), para(v)] for k, v in rows], colWidths=[38 * mm, 128 * mm])
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, RULE),
        ]))
        return table

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(22 * mm, 12 * mm, f"{APP_NAME}  |  {a.reference}")
        canvas.drawRightString(A4[0] - 22 * mm, 12 * mm, f"Page {doc.page}")
        canvas.restoreState()

    amount = f"{a.currency} {a.payment_amount:,.2f}" if a.payment_amount is not None else "-"

    story = [
        para(APP_NAME, brand),
        Spacer(1, 6),
        para(a.title, title),
        para(f"Agreement ID: {a.reference}   |   Status: {wf.normalize_status(a.status)}", small),
        Spacer(1, 10),
        para("Parties", h2),
        kv([
            ("Party 1", f"{a.party_one_name or '-'}  ({a.party_one_email or 'no email'})"),
            ("Party 2", f"{a.counterpart}  ({a.party_two_email or 'no email'})"),
        ]),
        para("Details", h2),
        kv([
            ("Type", a.agreement_type),
            ("Payment amount", amount),
            ("Start date", _d(a.start_date)),
            ("End date", _d(a.end_date)),
            ("Due date", _d(a.due_date)),
            ("Created", _dt(a.created_at)),
            ("Last updated", _dt(a.updated_at)),
        ]),
    ]

    sections = [
        ("Description", a.description), ("Agreement", a.content),
        ("Scope of work", a.scope_of_work), ("Payment terms", a.payment_terms),
        ("Delivery terms", a.delivery_terms), ("Responsibilities", a.responsibilities),
        ("Cancellation terms", a.cancellation_terms), ("Additional terms", a.additional_terms),
    ]
    for heading, text in sections:
        if text and text.strip():
            story += [para(heading, h2), para(text)]

    story.append(para("Signatures", h2))
    if signatures:
        rows = [[para(x, label) for x in ("Party", "Signed name", "Email", "Signed at")]]
        for s in signatures:
            rows.append([para(ROLES.get(s.role, s.role)), para(s.signed_name),
                         para(s.signer_email), para(_dt(s.signed_at))])
        table = Table(rows, colWidths=[22 * mm, 50 * mm, 52 * mm, 42 * mm])
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.25, RULE),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)
        if a.signed_at:
            story.append(para(f"Fully signed: {_dt(a.signed_at)}", small))
    else:
        story.append(para("No signatures yet."))

    story += [
        Spacer(1, 16),
        para("Signatures on this document are typed-name acknowledgements recorded by "
             f"{APP_NAME}. This is not legal advice, and enforceability of electronic "
             "signatures varies by jurisdiction.", small),
    ]

    doc = SimpleDocTemplate(
        buf, pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm,
        topMargin=22 * mm, bottomMargin=20 * mm, title=a.title, author=APP_NAME,
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()