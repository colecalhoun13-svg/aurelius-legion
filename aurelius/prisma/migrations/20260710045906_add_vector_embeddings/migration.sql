CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "VectorEmbedding" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "chunkText" TEXT NOT NULL,
    "operatorId" TEXT,
    "domain" TEXT,
    "embedding" vector(1536),
    "embeddingModel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VectorEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VectorEmbedding_sourceType_sourceId_idx" ON "VectorEmbedding"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "VectorEmbedding_operatorId_idx" ON "VectorEmbedding"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "VectorEmbedding_sourceType_sourceId_chunkIndex_key" ON "VectorEmbedding"("sourceType", "sourceId", "chunkIndex");

-- HNSW index for fast cosine similarity search
CREATE INDEX "VectorEmbedding_embedding_hnsw_idx" ON "VectorEmbedding"
  USING hnsw (embedding vector_cosine_ops);
