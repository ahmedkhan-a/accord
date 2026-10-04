export const TEMPLATES = {
  freelance: {
    label: 'Freelance service contract',
    fields: {
      agreement_type: 'Service agreement',
      content:
        'This agreement is between the Client and the Freelancer for the services described below. The Freelancer will deliver the work professionally and on time. The Client will provide the information and approvals needed to complete the work.',
      scope_of_work: 'Describe the work to be delivered: [deliverables, features, number of revisions].',
      payment_terms: '50% of the total amount is due before work starts. The remaining 50% is due on delivery. Late payments may be charged interest.',
      delivery_terms: 'Work will be delivered by the end date. Delays caused by late client feedback extend the deadline by the same period.',
      responsibilities: 'Freelancer: deliver the agreed work. Client: give feedback within 3 business days and pay on time.',
      cancellation_terms: 'Either party may cancel with 7 days written notice. Work completed up to that date is paid for.',
      additional_terms: 'The Freelancer keeps ownership of the work until full payment is received. This template is not legal advice.',
    },
  },
  nda: {
    label: 'Mutual NDA',
    fields: {
      agreement_type: 'NDA',
      content:
        'Both parties agree to keep confidential all non-public information shared with each other in connection with this relationship, and to use it only for the agreed purpose.',
      scope_of_work: 'Confidential information includes business plans, designs, code, customer lists and any information marked or reasonably understood as confidential.',
      payment_terms: 'No payment is due under this agreement.',
      delivery_terms: '',
      responsibilities: 'Each party must protect the information with reasonable care and share it only with people who need it and are bound by confidentiality.',
      cancellation_terms: 'Either party may end this agreement with written notice. Confidentiality duties continue for 2 years after.',
      additional_terms: 'Information that is public, already known, or required by law to be disclosed is not covered. This template is not legal advice.',
    },
  },
  retainer: {
    label: 'Monthly retainer',
    fields: {
      agreement_type: 'Retainer agreement',
      content:
        'The Client engages the Provider on a monthly retainer to provide the services below, up to the agreed hours each month.',
      scope_of_work: 'Describe the monthly services and the number of hours included: [services, hours per month].',
      payment_terms: 'The monthly fee is invoiced at the start of each month and due within 7 days. Unused hours do not carry over.',
      delivery_terms: 'Requests are answered within 2 business days. Work is delivered as agreed in each request.',
      responsibilities: 'Provider: deliver the services and report hours used. Client: send clear requests and pay on time.',
      cancellation_terms: 'Either party may cancel with 30 days written notice.',
      additional_terms: 'Extra work beyond the included hours is billed at the agreed hourly rate. This template is not legal advice.',
    },
  },
}