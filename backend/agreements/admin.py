from django.contrib import admin

from .models import Agreement, AgreementHistory, Signature


@admin.register(Agreement)
class AgreementAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "status", "counterpart", "updated_at")
    list_filter = ("status",)
    search_fields = ("title", "counterpart", "party_two_email")
    readonly_fields = ("share_token", "created_at", "updated_at")


@admin.register(AgreementHistory)
class AgreementHistoryAdmin(admin.ModelAdmin):
    list_display = ("agreement", "event_type", "user", "created_at")
    list_filter = ("event_type",)


@admin.register(Signature)
class SignatureAdmin(admin.ModelAdmin):
    list_display = ("agreement", "role", "signed_name", "signed_at")