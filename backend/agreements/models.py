from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Agreement(models.Model):
    # --- existing fields (unchanged) ---
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="agreements",
        null=True, blank=True,
    )
    title = models.CharField(max_length=200)
    agreement_type = models.CharField(max_length=100, default="Service agreement")
    counterpart = models.CharField(max_length=200)  # = party two's name
    status = models.CharField(max_length=50, default="Draft")
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- parties ---
    party_one_name = models.CharField(max_length=200, blank=True)
    party_one_email = models.EmailField(blank=True)
    party_two_email = models.EmailField(blank=True)

    # --- content ---
    description = models.TextField(blank=True)
    content = models.TextField(blank=True)
    scope_of_work = models.TextField(blank=True)
    payment_terms = models.TextField(blank=True)
    delivery_terms = models.TextField(blank=True)
    responsibilities = models.TextField(blank=True)
    cancellation_terms = models.TextField(blank=True)
    additional_terms = models.TextField(blank=True)

    # --- money / dates ---
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # --- sharing / lifecycle ---
    share_token = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    @property
    def reference(self):
        return f"AGR-{self.id:06d}"

    def __str__(self):
        return self.title


class AgreementHistory(models.Model):
    agreement = models.ForeignKey(Agreement, on_delete=models.CASCADE, related_name="history")
    event_type = models.CharField(max_length=50)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name_plural = "agreement history"

    def __str__(self):
        return f"{self.agreement_id}: {self.event_type}"


class Signature(models.Model):
    ROLE_CHOICES = [
        ("party_one", "Party 1 (owner)"),
        ("party_two", "Party 2 (counterparty)"),
    ]

    agreement = models.ForeignKey(Agreement, on_delete=models.CASCADE, related_name="signatures")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    signed_name = models.CharField(max_length=200)
    signer_email = models.EmailField()
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    signed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["signed_at"]
        constraints = [
            models.UniqueConstraint(fields=["agreement", "role"], name="one_signature_per_role"),
        ]

    def __str__(self):
        return f"{self.signed_name} ({self.role})"