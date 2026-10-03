"""Pydantic models for the OrgChai API."""

from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
from urllib.parse import urlparse


class DocumentChunk(BaseModel):
    """A chunk of a document with source metadata."""

    text: str
    source: str
    score: Optional[float] = None
    source_url: Optional[str] = None
    preview_url: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    reviewed_at: Optional[str] = None
    expires_at: Optional[str] = None
    provenance: Optional[str] = None


class AskRequest(BaseModel):
    """Request body for the /ask endpoint."""

    question: str = Field(min_length=1, max_length=4000)
    top_k: int = Field(default=3, ge=1, le=10)
    generate: bool = True
    mode: Literal["answer", "compare", "summarize", "checklist", "research"] = "answer"
    language: Literal["default", "en", "ja"] = "default"


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=10, ge=1, le=50)
    source_system: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = Field(default=None, max_length=40)
    owner: Optional[str] = Field(default=None, max_length=200)
    topic: Optional[str] = Field(default=None, max_length=200)
    department: Optional[str] = Field(default=None, max_length=200)
    data_classification: Optional[Literal["internal", "personal", "restricted"]] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    collection_id: Optional[str] = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValueError("effective_from must be before effective_to")
        return self


class AskResponse(BaseModel):
    """Response from the /ask endpoint."""

    question: str = Field(min_length=1, max_length=4000)
    answer: str
    sources: List[DocumentChunk]
    model: str


class IngestResponse(BaseModel):
    """Response from the /ingest endpoint."""

    filename: str
    chunks_added: int
    total_chunks: int


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    id: str
    role: str
    content: str
    created_at: str
    sources: Optional[List[DocumentChunk]] = None
    model: Optional[str] = None


class ChatSummary(BaseModel):
    """Lightweight chat metadata for sidebar listings."""

    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class ChatSession(BaseModel):
    """A full chat session with all messages."""

    id: str
    title: str
    created_at: str
    updated_at: str
    messages: List[ChatMessage]


class SendChatRequest(BaseModel):
    """Request body for sending a message to a chat."""

    question: str
    top_k: int = Field(default=3, ge=1, le=10)
    generate: bool = True
    mode: Literal["answer", "compare", "summarize", "checklist", "research"] = "answer"
    language: Literal["default", "en", "ja"] = "default"
    context_sources: List[str] = Field(default_factory=list, max_length=10)


class RenameChatRequest(BaseModel):
    """Request body for renaming a chat."""

    title: str = Field(min_length=1, max_length=120)


class DeleteChatsRequest(BaseModel):
    confirmation: Literal["DELETE"]


class DeleteUserDataRequest(BaseModel):
    confirmation: Literal["DELETE MY DATA"]


class RetentionPolicyRequest(BaseModel):
    chat_days: int = Field(default=0, ge=0, le=36500)
    source_copy_days: int = Field(default=0, ge=0, le=36500)
    embedding_days: int = Field(default=0, ge=0, le=36500)
    audit_event_days: int = Field(default=0, ge=0, le=36500)
    metrics_days: int = Field(default=0, ge=0, le=36500)
    feedback_days: int = Field(default=0, ge=0, le=36500)


class RetentionApplyRequest(BaseModel):
    confirmation: Literal["APPLY RETENTION"]


class DlpPolicyRequest(BaseModel):
    action: Literal["flag", "redact", "block"]


class AdminPolicyRequest(BaseModel):
    approved_connector_kinds: List[str] = Field(default_factory=list, max_length=10)
    approved_models: List[str] = Field(default_factory=list, max_length=10)
    web_access: Literal["disabled", "approved_only", "enabled"] = "disabled"
    allowed_data_classes: List[Literal["internal", "personal", "restricted"]] = Field(default_factory=list, max_length=3)
    allowed_tools: List[str] = Field(default_factory=list, max_length=20)
    action_scopes: List[str] = Field(default_factory=list, max_length=20)


class ActionProposalRequest(BaseModel):
    action_type: str = Field(min_length=1, max_length=100)
    idempotency_key: Optional[str] = Field(default=None, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    target: Optional[str] = Field(default=None, max_length=300)
    inputs: dict[str, str] = Field(default_factory=dict)
    source_ids: List[str] = Field(default_factory=list, max_length=20)
    permission_scope: str = Field(min_length=1, max_length=200)
    expected_side_effects: List[str] = Field(default_factory=list, max_length=20)


class ActionDecisionRequest(BaseModel):
    status: Literal["approved", "rejected"]
    note: Optional[str] = Field(default=None, max_length=1000)


class CollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    source_ids: List[str] = Field(default_factory=list, max_length=200)
    authoritative: bool = False
    boost: int = Field(default=0, ge=0, le=10)


class SavedSearchRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    query: str = Field(min_length=1, max_length=500)
    filters: dict[str, str] = Field(default_factory=dict)


class GlossaryRequest(BaseModel):
    term: str = Field(min_length=1, max_length=100)
    synonyms: List[str] = Field(default_factory=list, max_length=20)
    definition: Optional[str] = Field(default=None, max_length=500)


class EvaluationCaseRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    question: str = Field(min_length=1, max_length=500)
    expected_sources: List[str] = Field(default_factory=list, max_length=20)
    language: Literal["default", "en", "ja"] = "default"


class WorkflowProposalRequest(BaseModel):
    inputs: dict[str, str] = Field(default_factory=dict)
    source_ids: List[str] = Field(default_factory=list, max_length=20)
    idempotency_key: Optional[str] = Field(default=None, max_length=100)


class SlackSummaryRequest(BaseModel):
    channel_id: str = Field(min_length=1, max_length=100)
    thread_ts: Optional[str] = Field(default=None, max_length=40)
    limit: int = Field(default=50, ge=1, le=200)
    language: Literal["default", "en", "ja"] = "default"


class SlackDigestRequest(BaseModel):
    channel_ids: List[str] = Field(min_length=1, max_length=20)
    destination_channel: Optional[str] = Field(default=None, max_length=100)
    schedule: Literal["on_demand", "hourly", "daily"] = "on_demand"
    limit: int = Field(default=50, ge=1, le=200)
    language: Literal["default", "en", "ja"] = "default"


class SourceClickRequest(BaseModel):
    source: str = Field(min_length=1, max_length=500)


class DirectoryUserRequest(BaseModel):
    external_id: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    display_name: Optional[str] = Field(default=None, max_length=200)
    groups: List[str] = Field(default_factory=list, max_length=100)
    roles: List[str] = Field(default_factory=list, max_length=20)
    active: bool = True
    source: str = Field(default="directory", max_length=100)


class FeedbackRequest(BaseModel):
    message_id: str = Field(min_length=1, max_length=128)
    kind: Literal["helpful", "not_helpful", "incorrect", "missing_source", "report_concern"]
    note: Optional[str] = Field(default=None, max_length=1000)


class ReviewUpdateRequest(BaseModel):
    status: Literal["open", "in_review", "resolved", "dismissed"]
    note: Optional[str] = Field(default=None, max_length=1000)


class DocumentMetadataRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    source_url: Optional[str] = Field(default=None, max_length=1000)
    status: Literal["draft", "approved", "verified", "expired", "archived", "superseded"] = "draft"
    owner: Optional[str] = Field(default=None, max_length=200)
    subject_matter_expert: Optional[str] = Field(default=None, max_length=200)
    source_system: Optional[str] = Field(default=None, max_length=100)
    topic: Optional[str] = Field(default=None, max_length=200)
    department: Optional[str] = Field(default=None, max_length=200)
    allowed_emails: Optional[List[str]] = Field(default=None, max_length=100)
    allowed_domains: Optional[List[str]] = Field(default=None, max_length=100)
    allowed_groups: Optional[List[str]] = Field(default=None, max_length=100)
    last_reviewed_at: Optional[date] = None
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    data_classification: Optional[Literal["internal", "personal", "restricted"]] = None
    change_note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("source_url must be an HTTP or HTTPS URL")
        return value


class ConnectorCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Literal["local_folder", "google_drive", "sharepoint", "rest_api"] = "local_folder"
    root_path: str = Field(default="", max_length=1000)
    token_env: Optional[str] = Field(default=None, max_length=100)
    scope_id: Optional[str] = Field(default=None, max_length=300)
    drive_id: Optional[str] = Field(default=None, max_length=300)
    endpoint_url: Optional[str] = Field(default=None, max_length=2000)
    integration_category: Optional[Literal["ticketing", "hr", "project_tracking", "calendar", "directory"]] = None
    schedule: Optional[str] = Field(default=None, max_length=100)
    retry_limit: int = Field(default=3, ge=0, le=5)
    retry_backoff_seconds: int = Field(default=5, ge=0, le=3600)
    webhook_secret_env: Optional[str] = Field(default=None, max_length=100)


class ConnectorUpdateRequest(BaseModel):
    status: Optional[Literal["active", "paused"]] = None
    root_path: Optional[str] = Field(default=None, max_length=1000)
    token_env: Optional[str] = Field(default=None, max_length=100)
    scope_id: Optional[str] = Field(default=None, max_length=300)
    drive_id: Optional[str] = Field(default=None, max_length=300)
    endpoint_url: Optional[str] = Field(default=None, max_length=2000)
    integration_category: Optional[Literal["ticketing", "hr", "project_tracking", "calendar", "directory"]] = None
    schedule: Optional[str] = Field(default=None, max_length=100)
    retry_limit: Optional[int] = Field(default=None, ge=0, le=5)
    retry_backoff_seconds: Optional[int] = Field(default=None, ge=0, le=3600)
    webhook_secret_env: Optional[str] = Field(default=None, max_length=100)
