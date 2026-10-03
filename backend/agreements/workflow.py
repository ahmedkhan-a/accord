DRAFT = "Draft"
SENT = "Sent"
VIEWED = "Viewed"
IN_REVIEW = "In Review"
AWAITING = "Awaiting Signature"
PARTIAL = "Partially Signed"
SIGNED = "Signed"
REJECTED = "Rejected"
EXPIRED = "Expired"

ALL = [DRAFT, SENT, VIEWED, IN_REVIEW, AWAITING, PARTIAL, SIGNED, REJECTED, EXPIRED]

TRANSITIONS = {
    DRAFT: {SENT},
    SENT: {VIEWED, REJECTED, EXPIRED},
    VIEWED: {IN_REVIEW, AWAITING, REJECTED, EXPIRED},
    IN_REVIEW: {AWAITING, REJECTED, EXPIRED},
    AWAITING: {PARTIAL, REJECTED, EXPIRED},
    PARTIAL: {SIGNED, EXPIRED},
    SIGNED: set(),
    REJECTED: {DRAFT},   # reopen
    EXPIRED: {DRAFT},    # reopen
}

PENDING = {SENT, VIEWED, IN_REVIEW, AWAITING, PARTIAL}
EDITABLE = {DRAFT}
SIGNABLE = {AWAITING, PARTIAL}
REJECTABLE = {SENT, VIEWED, IN_REVIEW, AWAITING}


def normalize_status(value):
    """Maps legacy values like 'In review' to the canonical names."""
    text = (value or "").strip().lower()
    if not text:
        return DRAFT
    for status in ALL:
        if status.lower() == text:
            return status
    return value


def can_transition(current, new):
    return new in TRANSITIONS.get(current, set())