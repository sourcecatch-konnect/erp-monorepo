"use client";

import { useFormContext } from "react-hook-form";
import {
  FEEDBACK_MAX_ANSWER_CHARS,
  FEEDBACK_QUESTIONS,
} from "@skerp/validators";
import type { FeedbackCategory } from "@skerp/types";
import { Input } from "@skerp/ui/components/input";
import { Textarea } from "@skerp/ui/components/textarea";
import type { FeedbackFormValues } from "../form-values";

/**
 * The questions for the chosen type, asked in plain language.
 *
 * Optional on purpose: the reporter must say something somewhere, but no
 * single question blocks sending, so a quick "this is confusing" still takes
 * ten seconds while a bug report gets steered into steps / expected / actual.
 *
 * Registered with `useFormContext` under `answers.<key>`, so the whole set
 * arrives as one object and needs no per-type form state.
 */
export function QuestionFields({ category }: { category: FeedbackCategory }) {
  const { register } = useFormContext<FeedbackFormValues>();
  const questions = FEEDBACK_QUESTIONS[category] ?? [];

  if (questions.length === 0) return null;

  return (
    <div className="grid gap-3">
      {questions.map((question) => {
        const id = `feedback-answer-${question.key}`;
        const field = register(`answers.${question.key}` as const, {
          maxLength: FEEDBACK_MAX_ANSWER_CHARS,
        });
        return (
          <div key={question.key} className="grid gap-1.5">
            <label
              htmlFor={id}
              className="text-xs font-medium text-muted-foreground"
            >
              {question.label}
            </label>
            {question.long ? (
              <Textarea
                id={id}
                rows={2}
                placeholder={question.placeholder}
                maxLength={FEEDBACK_MAX_ANSWER_CHARS}
                {...field}
              />
            ) : (
              <Input
                id={id}
                placeholder={question.placeholder}
                maxLength={FEEDBACK_MAX_ANSWER_CHARS}
                {...field}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
