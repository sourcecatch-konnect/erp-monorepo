"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  IconCircleCheck,
  IconCircleX,
  IconListCheck,
} from "@tabler/icons-react";
import type { TrainingQuizResult, TrainingQuizView } from "@skerp/types";
import { Button } from "@skerp/ui/components/button";
import { RadioGroup, RadioGroupItem } from "@skerp/ui/components/radioButton";
import { Skeleton } from "@skerp/ui/components/skeleton";
import { cn } from "@skerp/ui/lib/util";
import { trainingKeys } from "../training.keys";
import { quizApi } from "../training.service";
import { ProgressBar } from "./ProgressBar";

// Radix sets data-state="checked"; the shared radio's `data-checked:` fill never matches.
const CHECKED =
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Mode = "intro" | "asking" | "result";

function QuestionStep({
  quiz,
  index,
  answers,
  onAnswer,
}: {
  quiz: TrainingQuizView;
  index: number;
  answers: Record<string, number>;
  onAnswer: (questionId: string, option: number) => void;
}) {
  const question = quiz.questions[index]!;
  const chosen = answers[question.id];
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 text-base font-medium text-foreground">{question.question}</legend>
      <RadioGroup
        value={chosen === undefined ? "" : String(chosen)}
        onValueChange={(value) => onAnswer(question.id, Number(value))}
      >
        {question.options.map((option, optionIndex) => {
          const id = `${question.id}-${optionIndex}`;
          return (
            <label
              key={id}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-3 py-3 transition-colors duration-150 hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem id={id} value={String(optionIndex)} className={cn("mt-0.5", CHECKED)} />
              <span className="text-sm text-foreground">
                <span className="mr-2 font-semibold text-muted-foreground">{LETTERS[optionIndex]}</span>
                {option}
              </span>
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}

function ResultView({
  quiz,
  result,
  onRetry,
}: {
  quiz: TrainingQuizView;
  result: TrainingQuizResult;
  onRetry: () => void;
}) {
  const needed = Math.ceil((quiz.passPercent / 100) * result.total);
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-md border px-4 py-3",
          result.passed ? "border-primary/30 bg-primary/5" : "border-border bg-muted/40",
        )}
      >
        {result.passed ? (
          <IconCircleCheck className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
        ) : (
          <IconListCheck className="mt-0.5 size-6 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <div>
          <p className="text-base font-semibold text-foreground">
            You got {result.score} of {result.total} right
            {result.passed ? ". You passed." : "."}
          </p>
          <p className="text-sm text-muted-foreground">
            {result.passed
              ? "Well done. Your result is saved on your training record."
              : `You need ${needed} right to pass. Read the explanations below, then try again.`}
          </p>
        </div>
      </div>

      <ol className="space-y-3">
        {result.results.map((item, index) => {
          const question = quiz.questions.find((q) => q.id === item.id);
          if (!question) return null;
          return (
            <li key={item.id} className="space-y-1.5 rounded-md border border-border bg-card p-4">
              <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                {item.correct ? (
                  <IconCircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Correct" />
                ) : (
                  <IconCircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Not correct" />
                )}
                {index + 1}. {question.question}
              </p>
              {!item.correct && item.chosen !== null ? (
                <p className="pl-6 text-sm text-muted-foreground">
                  Your answer: {question.options[item.chosen]}
                </p>
              ) : null}
              <p className="pl-6 text-sm text-foreground">
                Right answer: <span className="font-medium">{question.options[item.answer]}</span>
              </p>
              <p className="pl-6 text-sm text-muted-foreground">{item.explain}</p>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/training">Back to My role & training</Link>
        </Button>
      </div>
    </div>
  );
}

/** A10 — a short quiz at the end of a track. Informational: never blocks access. */
export function QuizPanel({ trackKey, primary }: { trackKey: string; primary: boolean }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("intro");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<TrainingQuizResult | null>(null);

  const { data: quiz, isLoading, isError } = useQuery({
    queryKey: trainingKeys.quiz(trackKey),
    queryFn: () => quizApi.get(trackKey),
  });

  const submit = useMutation({
    mutationFn: () => quizApi.submit(trackKey, { answers }),
    onSuccess: (graded) => {
      setResult(graded);
      setMode("result");
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    },
    onError: (error) => toast.error(`We couldn't check your answers: ${error.message}`),
  });

  const start = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setMode("asking");
  };

  if (isError) return null;

  return (
    <section className="space-y-4 rounded-md border border-border bg-card p-5" aria-labelledby="quiz-title">
      <div className="flex items-start gap-3">
        <IconListCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 id="quiz-title" className="text-base font-semibold text-foreground">
            Check what you have learned
          </h2>
          {quiz ? (
            <p className="text-sm text-muted-foreground">
              {quiz.questions.length} short questions. You need{" "}
              {Math.ceil((quiz.passPercent / 100) * quiz.questions.length)} right to pass,
              and you can try as many times as you like.
            </p>
          ) : null}
        </div>
      </div>

      {isLoading || !quiz ? (
        <Skeleton className="h-24 w-full" />
      ) : mode === "intro" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={primary ? "default" : "outline"} onClick={start}>
            {quiz.attempts > 0 ? "Take the quiz again" : "Start the quiz"}
          </Button>
          {quiz.best ? (
            <p className="text-sm text-muted-foreground">
              Best so far: {quiz.best.bestScore} of {quiz.best.total}
              {quiz.best.passed && quiz.best.passedAt
                ? ` · passed on ${format(new Date(quiz.best.passedAt), "dd MMM yyyy")}`
                : " · not passed yet"}
            </p>
          ) : null}
        </div>
      ) : mode === "asking" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ProgressBar
              percent={Math.round(((index + 1) / quiz.questions.length) * 100)}
              label="Quiz progress"
              className="max-w-xs"
            />
            <span className="shrink-0 text-xs text-muted-foreground">
              Question {index + 1} of {quiz.questions.length}
            </span>
          </div>
          <QuestionStep
            quiz={quiz}
            index={index}
            answers={answers}
            onAnswer={(id, option) => setAnswers((current) => ({ ...current, [id]: option }))}
          />
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex((current) => current - 1)}
            >
              Back
            </Button>
            {index < quiz.questions.length - 1 ? (
              <Button
                disabled={answers[quiz.questions[index]!.id] === undefined}
                onClick={() => setIndex((current) => current + 1)}
              >
                Next question
              </Button>
            ) : (
              <Button
                disabled={
                  submit.isPending ||
                  quiz.questions.some((q) => answers[q.id] === undefined)
                }
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? "Checking…" : "See my result"}
              </Button>
            )}
          </div>
        </div>
      ) : result ? (
        <ResultView quiz={quiz} result={result} onRetry={start} />
      ) : null}
    </section>
  );
}
