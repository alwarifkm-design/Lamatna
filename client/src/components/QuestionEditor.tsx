import { useState } from "react";
import type { Question } from "../types";

interface QuestionEditorProps {
  initial?: Question;
  onSave: (q: Omit<Question, "id"> & { id?: string }) => void;
  onCancel: () => void;
}

const empty = (): Omit<Question, "id"> => ({
  text: "",
  options: [{ text: "" }, { text: "" }, { text: "" }, { text: "" }],
  correctIndex: 0,
});

export function QuestionEditor({ initial, onSave, onCancel }: QuestionEditorProps) {
  const [form, setForm] = useState<Omit<Question, "id"> & { id?: string }>(
    initial ?? empty()
  );

  const updateOption = (i: number, text: string) => {
    const options = [...form.options];
    options[i] = { text };
    setForm({ ...form, options });
  };

  const valid =
    form.text.trim() &&
    form.options.every((o) => o.text.trim()) &&
    form.options.length >= 2;

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <h3 style={{ marginBottom: "0.75rem" }}>{initial ? "تعديل السؤال" : "سؤال جديد"}</h3>
      <textarea
        className="input-field"
        rows={3}
        placeholder="نص السؤال"
        value={form.text}
        onChange={(e) => setForm({ ...form, text: e.target.value })}
        style={{ resize: "vertical", marginBottom: "0.75rem" }}
      />
      {form.options.map((opt, i) => (
        <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
          <input
            type="radio"
            name="correct"
            checked={form.correctIndex === i}
            onChange={() => setForm({ ...form, correctIndex: i })}
            title="الإجابة الصحيحة"
          />
          <input
            className="input-field"
            placeholder={`الخيار ${i + 1}`}
            value={opt.text}
            onChange={(e) => updateOption(i, e.target.value)}
          />
        </div>
      ))}
      <p style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "1rem" }}>
        اختر الدائرة بجانب الإجابة الصحيحة
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid}
          onClick={() => onSave(form)}
        >
          حفظ
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
