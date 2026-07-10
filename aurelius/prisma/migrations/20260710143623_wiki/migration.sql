
-- CreateTable
CREATE TABLE "WikiPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRefs" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT NOT NULL DEFAULT 'aurelius',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiRevision" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WikiRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WikiPage_slug_key" ON "WikiPage"("slug");

-- CreateIndex
CREATE INDEX "WikiRevision_pageId_revision_idx" ON "WikiRevision"("pageId", "revision");

-- AddForeignKey
ALTER TABLE "WikiRevision" ADD CONSTRAINT "WikiRevision_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WikiPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

