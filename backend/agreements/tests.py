from django.test import Client, TestCase

API = "/api/agreements/"
PW = "S3cure-pass!word"


def post(client, url, data=None):
    return client.post(url, data or {}, content_type="application/json")


class AgreementFlowTests(TestCase):
    def setUp(self):
        self.owner, self.other, self.guest = Client(), Client(), Client()
        for client, email in ((self.owner, "a@example.com"), (self.other, "b@example.com")):
            r = post(client, API + "register/", {"name": "User", "email": email, "password": PW})
            self.assertEqual(r.status_code, 201)

    def make(self):
        r = post(self.owner, API, {
            "title": "Website build", "counterpart": "Jane", "party_two_email": "jane@example.com",
            "content": "Terms here.", "payment_amount": "500", "currency": "usd",
        })
        self.assertEqual(r.status_code, 201)
        return r.json()["id"]

    def test_privacy_and_auth(self):
        pk = self.make()
        self.assertEqual(self.guest.get(API).status_code, 401)
        self.assertEqual(self.other.get(f"{API}{pk}/").status_code, 404)
        self.assertEqual(self.other.put(f"{API}{pk}/", {"title": "x"}, content_type="application/json").status_code, 404)
        self.assertEqual(self.other.delete(f"{API}{pk}/").status_code, 404)
        self.assertEqual(self.other.get(f"{API}{pk}/pdf/").status_code, 404)
        self.assertEqual(self.other.get(API).json(), [])

    def test_full_flow(self):
        pk = self.make()
        # cannot sign or share-view a draft
        self.assertEqual(post(self.owner, f"{API}{pk}/sign/", {"signed_name": "Alice Owner", "consent": True}).status_code, 409)

        sent = post(self.owner, f"{API}{pk}/send/").json()
        self.assertEqual(sent["status"], "Sent")
        share = sent["share_path"].replace("/agreement/", f"{API}")  # /api/agreements/share/<token>
        share = f"{API}share/{sent['share_path'].rsplit('/', 1)[-1]}/"

        # editing after send is blocked
        r = self.owner.put(f"{API}{pk}/", {"title": "Changed"}, content_type="application/json")
        self.assertEqual(r.status_code, 409)

        view = self.guest.get(share).json()
        self.assertEqual(view["status"], "Viewed")
        for leaked in ("history", "owner", "id", "share_token"):
            self.assertNotIn(leaked, view)

        self.assertEqual(self.guest.get(f"{API}share/not-a-real-token/").status_code, 404)
        self.assertEqual(post(self.guest, share + "respond/", {"action": "accept"}).json()["status"], "Awaiting Signature")

        bad = post(self.guest, share + "sign/", {"signed_name": "Jane Roe", "signer_email": "x@evil.com", "consent": True})
        self.assertEqual(bad.status_code, 400)
        ok = post(self.guest, share + "sign/", {"signed_name": "Jane Roe", "signer_email": "jane@example.com", "consent": True})
        self.assertEqual(ok.json()["status"], "Partially Signed")

        done = post(self.owner, f"{API}{pk}/sign/", {"signed_name": "User One", "consent": True}).json()
        self.assertEqual(done["status"], "Signed")
        self.assertIsNotNone(done["signed_at"])

        events = [h["event_type"] for h in done["history"]]
        for expected in ("created", "sent", "viewed", "accepted", "signature_added", "fully_signed"):
            self.assertIn(expected, events)

        pdf = self.owner.get(f"{API}{pk}/pdf/")
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))

        self.assertEqual(self.owner.delete(f"{API}{pk}/").status_code, 409)  # signed = locked

    def test_reject_and_reopen(self):
        pk = self.make()
        token = post(self.owner, f"{API}{pk}/send/").json()["share_path"].rsplit("/", 1)[-1]
        share = f"{API}share/{token}/"
        self.guest.get(share)
        self.assertEqual(post(self.guest, share + "reject/", {"reason": "Too high"}).json()["status"], "Rejected")
        self.assertEqual(post(self.owner, f"{API}{pk}/reopen/").json()["status"], "Draft")
        self.assertEqual(self.guest.get(share).status_code, 404)  # old link is dead