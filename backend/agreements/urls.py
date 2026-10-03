from django.urls import path

from . import views

urlpatterns = [
    # existing
    path("", views.agreements, name="agreements"),
    path("register/", views.register, name="register"),
    path("login/", views.user_login, name="login"),
    path("logout/", views.user_logout, name="logout"),
    path("me/", views.current_user, name="current_user"),
    path("<int:agreement_id>/", views.agreement_detail, name="agreement_detail"),

    # owner actions
    path("<int:agreement_id>/send/", views.agreement_send, name="agreement_send"),
    path("<int:agreement_id>/share/", views.agreement_share, name="agreement_share"),
    path("<int:agreement_id>/sign/", views.agreement_sign, name="agreement_sign"),
    path("<int:agreement_id>/reopen/", views.agreement_reopen, name="agreement_reopen"),
    path("<int:agreement_id>/history/", views.agreement_history, name="agreement_history"),
    path("<int:agreement_id>/pdf/", views.agreement_pdf, name="agreement_pdf"),

    # counterparty (token only)
    path("share/<str:token>/", views.shared_agreement, name="shared_agreement"),
    path("share/<str:token>/respond/", views.shared_respond, name="shared_respond"),
    path("share/<str:token>/sign/", views.shared_sign, name="shared_sign"),
    path("share/<str:token>/reject/", views.shared_reject, name="shared_reject"),
    path("share/<str:token>/pdf/", views.shared_pdf, name="shared_pdf"),
]