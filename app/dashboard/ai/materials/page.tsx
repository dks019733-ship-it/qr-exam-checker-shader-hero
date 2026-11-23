import { AiMaterialsWorkspace } from "@/components/ai-materials-workspace";
import type { MaterialKind } from "@/lib/ai-api";

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const params = await searchParams;
  const initialKind: MaterialKind = params.kind === "document" ? "document" : "exam";
  return <AiMaterialsWorkspace key={initialKind} initialKind={initialKind} />;
}
