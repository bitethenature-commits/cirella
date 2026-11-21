"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { SITE_PAGE_TEMPLATE_META, SITE_PAGE_TEMPLATES, type SitePageTemplate } from "@/lib/site-pages";
import { createSitePageAction } from "../actions";

export function NewPageForm() {
  const [state, action] = useActionState(createSitePageAction, undefined);
  const [template, setTemplate] = useState<SitePageTemplate>("about");
  const [title, setTitle] = useState(SITE_PAGE_TEMPLATE_META.about.title);
  const [touched, setTouched] = useState(false);
  return (
    <form action={action} className="space-y-5">
      <fieldset className="grid gap-2.5">
        <legend className="field-label">Plantilla</legend>
        {SITE_PAGE_TEMPLATES.map((t) => (
          <label key={t} className={`card flex cursor-pointer items-start gap-3 p-4 transition ${template === t ? "ring-2 ring-ink" : "hover:border-ink/30"}`}>
            <input
              type="radio"
              name="template"
              value={t}
              checked={template === t}
              onChange={() => {
                setTemplate(t);
                if (!touched) setTitle(t === "blank" ? "" : SITE_PAGE_TEMPLATE_META[t].title);
              }}
              className="mt-1 accent-[#0E1024]"
            />
            <span>
              <span className="block font-semibold">{SITE_PAGE_TEMPLATE_META[t].label}</span>
              <span className="block text-sm text-muted">{SITE_PAGE_TEMPLATE_META[t].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="page-title" className="field-label">Título</label>
        <input
          id="page-title"
          name="title"
          className="input"
          value={title}
          maxLength={120}
          placeholder="Nueva página"
          onChange={(e) => {
            setTitle(e.target.value);
            setTouched(true);
          }}
        />
      </div>
      {state?.error && <p className="text-sm text-rose" role="alert">{state.error}</p>}
      <SubmitButton pendingLabel="Creando…">Crear página</SubmitButton>
    </form>
  );
}
