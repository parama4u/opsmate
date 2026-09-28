"""Built-in workflow templates that produce reviewable proposals only."""


WORKFLOW_TEMPLATES = [
    {
        "id": "incident_summary",
        "title": "Incident summary",
        "action_type": "draft_incident_summary",
        "description": "Prepare a source-backed incident summary for human review.",
        "required_inputs": ["incident_details", "audience"],
    },
    {
        "id": "onboarding_plan",
        "title": "Onboarding plan",
        "action_type": "draft_onboarding_plan",
        "description": "Draft an onboarding plan using approved procedures.",
        "required_inputs": ["person_name", "team", "start_date"],
    },
    {
        "id": "it_access",
        "title": "IT access request",
        "action_type": "draft_it_access_request",
        "description": "Prepare an IT access request for approval.",
        "required_inputs": ["person_name", "systems", "business_justification"],
    },
    {
        "id": "policy_acknowledgement",
        "title": "Policy acknowledgement",
        "action_type": "draft_policy_acknowledgement",
        "description": "Draft a policy acknowledgement message.",
        "required_inputs": ["person_name", "policy_name", "due_date"],
    },
    {
        "id": "support_reply",
        "title": "Support reply",
        "action_type": "draft_support_reply",
        "description": "Draft a support response grounded in approved sources.",
        "required_inputs": ["customer_question", "tone"],
    },
]


def get_workflow(workflow_id: str) -> dict | None:
    return next((workflow for workflow in WORKFLOW_TEMPLATES if workflow["id"] == workflow_id), None)
