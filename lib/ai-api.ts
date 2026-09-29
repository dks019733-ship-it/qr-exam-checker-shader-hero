export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type MaterialKind = "exam" | "document";
export type MaterialStatus = "pending_review" | "approved";

export interface ExamQuestion {
  number: number;
  type: string;
  prompt: string;
  choices?: string[];
  answer: string;
  rationale?: string;
  points: number;
}

export interface MaterialContent {
  overview?: string;
  instructions?: string;
  learningObjectives?: string[];
  totalPoints?: number;
  questions?: ExamQuestion[];
  sections?: { heading: string; body: string }[];
}

export interface GeneratedMaterial {
  id: string;
  kind: MaterialKind;
  title: string;
  subject: string;
  grade_level: string;
  topic: string;
  learning_objectives: string;
  document_type: string | null;
  content: MaterialContent;
  status: MaterialStatus;
  review_notes: string;
  google_form: { form_id: string; edit_url: string; responder_url: string } | null;
  created_at: string;
  updated_at: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `เกิดข้อผิดพลาด (${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function requestBlob(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `เกิดข้อผิดพลาด (${response.status})`);
  }
  return response.blob();
}

export const chatApi = {
  listSessions: () => request<{ sessions: ChatSession[] }>("/api/ai/chat/sessions"),
  createSession: (title?: string) => request<{ session: ChatSession }>("/api/ai/chat/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  listMessages: (sessionId: string) => request<{ messages: ChatMessage[] }>(`/api/ai/chat/sessions/${encodeURIComponent(sessionId)}/messages`),
  sendMessage: (sessionId: string, content: string) => request<{ reply: ChatMessage }>(`/api/ai/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { method: "POST", body: JSON.stringify({ content }) }),
};

export const materialsApi = {
  list: () => request<{ materials: GeneratedMaterial[] }>("/api/ai/materials"),
  get: (id: string) => request<{ material: GeneratedMaterial }>(`/api/ai/materials/${encodeURIComponent(id)}`),
  generate: (input: { kind: MaterialKind; subject: string; gradeLevel: string; topic: string; learningObjectives?: string; questionCount?: number; questionTypes?: string[]; difficulty?: string; documentType?: string }) => request<{ material: GeneratedMaterial }>("/api/ai/materials/generate", { method: "POST", body: JSON.stringify(input) }),
  review: (id: string, input: { title?: string; content?: MaterialContent; reviewNotes?: string; status?: MaterialStatus }) => request<{ material: GeneratedMaterial }>(`/api/ai/materials/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  exportDocx: (id: string) => requestBlob(`/api/ai/materials/${encodeURIComponent(id)}/export/docx`),
};
