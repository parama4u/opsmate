CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "chats" (
    "id" VARCHAR(12) NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chats_user_id_idx" ON "chats"("user_id");

ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chat_messages" (
    "id" VARCHAR(8) NOT NULL,
    "chat_id" VARCHAR(12) NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_messages_chat_id_idx" ON "chat_messages"("chat_id");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "document_chunks" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "embedding" vector(384),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_chunks_source_idx" ON "document_chunks"("source");

CREATE INDEX "idx_document_chunks_embedding"
ON "document_chunks" USING hnsw (embedding vector_cosine_ops);
