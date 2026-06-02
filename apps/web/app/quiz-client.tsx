"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  biologyQuestionSections,
  chemistryQuestionSections,
  questionIsInSection,
  type QuestionSection,
} from "@testovnice/question-bank/src/sections";
import type { ChoiceKey, QuestionChoice, QuestionItem, SubjectCode } from "@testovnice/question-bank/src/types";

type Subject = SubjectCode;
type Mode = "sequence" | "practice" | "exam50" | "mistakes" | "favorites";
type View = "home" | "subject" | "pdfSections" | "session" | "results";

type Question = QuestionItem;

type QuestionStats = {
  attempts: number;
  correct: number;
  lastResult: "correct" | "wrong" | null;
  starred: boolean;
};

type SessionAnswer = {
  selected: ChoiceKey[];
  checked: boolean;
};

type SessionState = {
  subject: Subject;
  mode: Mode;
  questionIds: string[];
  choiceOrders?: Record<string, ChoiceKey[]>;
  index: number;
  answers: Record<string, SessionAnswer>;
  sectionId?: string | null;
};

type StudyState = {
  stats: Record<string, QuestionStats>;
  studyDates: string[];
};

type Props = {
  biologyQuestions: Question[];
  chemistryQuestions: Question[];
};

const STORAGE_KEY = "testovnice.study.v3";
const SESSION_KEY = "testovnice.session.v5";
const UI_KEY = "testovnice.ui.v5";

const questionSectionsBySubject: Record<SubjectCode, QuestionSection[]> = {
  biology: biologyQuestionSections,
  chemistry: chemistryQuestionSections,
};

const questionSectionsById = new Map(
  [...biologyQuestionSections, ...chemistryQuestionSections].map((section) => [section.id, section] as const),
);

function shuffle<T>(values: T[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function sortChoices(choices: ChoiceKey[]) {
  return [...choices].sort();
}

function isCorrectAnswer(selected: ChoiceKey[], correct: ChoiceKey[]) {
  const left = sortChoices(selected);
  const right = sortChoices(correct);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getStats(state: StudyState, questionId: string): QuestionStats {
  return (
    state.stats[questionId] ?? {
      attempts: 0,
      correct: 0,
      lastResult: null,
      starred: false,
    }
  );
}

function getQuestionSections(subject: Subject) {
  return questionSectionsBySubject[subject];
}

function getQuestionSection(sectionId?: string | null) {
  if (!sectionId) {
    return null;
  }

  return questionSectionsById.get(sectionId) ?? null;
}

function getQuestionSectionForQuestion(subject: Subject, questionNumber: number) {
  return getQuestionSections(subject).find((section) => questionIsInSection(questionNumber, section)) ?? null;
}

function formatQuestionRange(section: QuestionSection) {
  return `${section.fromQuestion}-${section.toQuestion}`;
}

function subjectLabel(subject: Subject) {
  return subject === "biology" ? "Biológia" : "Chémia";
}

function subjectDescription(subject: Subject) {
  return subject === "biology"
    ? "Prijímačkové otázky z biológie pripravené na každodenné precvičovanie."
    : "Otázky z chémie pre rýchly tréning, ostrý test aj opakovanie chýb.";
}

function subjectEmoji(subject: Subject) {
  return subject === "biology" ? "🧬" : "🧪";
}

function modeLabel(mode: Mode) {
  if (mode === "sequence") return "Okruhy";
  if (mode === "practice") return "Denný tréning";
  if (mode === "exam50") return "Náhodný test 100";
  if (mode === "mistakes") return "Opakovanie chýb";
  return "Obľúbené otázky";
}

function buildQuestionIds(mode: Mode, questionPool: Question[], study: StudyState) {
  if (mode === "sequence") {
    return [...questionPool]
      .sort((left, right) => left.sourceQuestionNumber - right.sourceQuestionNumber)
      .map((item) => item.id);
  }

  if (mode === "practice") {
    return shuffle(questionPool)
      .slice(0, Math.min(20, questionPool.length))
      .map((item) => item.id);
  }

  if (mode === "exam50") {
    return shuffle(questionPool)
      .slice(0, Math.min(100, questionPool.length))
      .map((item) => item.id);
  }

  if (mode === "mistakes") {
    const mistakePool = questionPool.filter((question) => getStats(study, question.id).lastResult === "wrong");
    const pool = mistakePool.length > 0 ? mistakePool : questionPool;
    return shuffle(pool)
      .slice(0, Math.min(25, pool.length))
      .map((item) => item.id);
  }

  const favoritePool = questionPool.filter((question) => getStats(study, question.id).starred);
  const pool = favoritePool.length > 0 ? favoritePool : questionPool;
  return shuffle(pool)
    .slice(0, Math.min(25, pool.length))
    .map((item) => item.id);
}

function buildChoiceOrders(questionIds: string[], questionsById: Record<string, Question>) {
  return questionIds.reduce<Record<string, ChoiceKey[]>>((result, questionId) => {
    const question = questionsById[questionId];
    result[questionId] = question ? shuffle(question.choices.map((choice) => choice.key)) : [];
    return result;
  }, {});
}

function hydrateSessionState(value: SessionState, questionsById: Record<string, Question>) {
  const choiceOrders = { ...(value.choiceOrders ?? {}) };
  let changed = false;

  for (const questionId of value.questionIds) {
    if (choiceOrders[questionId]?.length) {
      continue;
    }

    const question = questionsById[questionId];
    choiceOrders[questionId] = question ? shuffle(question.choices.map((choice) => choice.key)) : [];
    changed = true;
  }

  return changed ? { ...value, choiceOrders } : value;
}

function orderQuestionChoices(question: Question, choiceOrder?: ChoiceKey[]) {
  if (!choiceOrder || choiceOrder.length === 0) {
    return question.choices;
  }

  const choicesByKey = new Map(question.choices.map((choice) => [choice.key, choice] as const));
  const orderedChoices = choiceOrder
    .map((key) => choicesByKey.get(key))
    .filter((choice): choice is QuestionChoice => Boolean(choice));

  return orderedChoices.length === question.choices.length ? orderedChoices : question.choices;
}

export default function QuizClient({ biologyQuestions, chemistryQuestions }: Props) {
  const [subject, setSubject] = useState<Subject>("biology");
  const [view, setView] = useState<View>("home");
  const [study, setStudy] = useState<StudyState>({ stats: {}, studyDates: [] });
  const [session, setSession] = useState<SessionState | null>(null);
  const [ready, setReady] = useState(false);

  const questions = useMemo(() => [...biologyQuestions, ...chemistryQuestions], [biologyQuestions, chemistryQuestions]);
  const questionsById = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question])) as Record<string, Question>,
    [questions],
  );

  const biologyStudyQuestions = useMemo(
    () => biologyQuestions.filter((question) => question.correctChoices.length > 0),
    [biologyQuestions],
  );
  const chemistryStudyQuestions = useMemo(
    () => chemistryQuestions.filter((question) => question.correctChoices.length > 0),
    [chemistryQuestions],
  );

  const subjectQuestions = useMemo(
    () => (subject === "biology" ? biologyStudyQuestions : chemistryStudyQuestions),
    [biologyStudyQuestions, chemistryStudyQuestions, subject],
  );
  const subjectQuestionSections = useMemo(() => getQuestionSections(subject), [subject]);

  useEffect(() => {
    setReady(true);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const storedSession = window.localStorage.getItem(SESSION_KEY);
    const storedUi = window.localStorage.getItem(UI_KEY);

    if (stored) {
      setStudy(JSON.parse(stored) as StudyState);
    }
    if (storedSession) {
      setSession(hydrateSessionState(JSON.parse(storedSession) as SessionState, questionsById));
    }
    if (storedUi) {
      const parsed = JSON.parse(storedUi) as { subject?: Subject; view?: View };
      if (parsed.subject) setSubject(parsed.subject);
      if (parsed.view) setView(parsed.view);
    }
  }, [questionsById]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(study));
  }, [ready, study]);

  useEffect(() => {
    if (!ready) return;
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [ready, session]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(UI_KEY, JSON.stringify({ subject, view }));
  }, [ready, subject, view]);

  const currentQuestion = session ? questionsById[session.questionIds[session.index]] : null;
  const currentAnswer =
    currentQuestion && session ? session.answers[currentQuestion.id] ?? { selected: [], checked: false } : null;
  const currentStats = currentQuestion ? getStats(study, currentQuestion.id) : getStats(study, "");
  const sessionSection =
    session && session.sectionId
      ? (() => {
          const section = getQuestionSection(session.sectionId);
          return section?.subject === session.subject ? section : null;
        })()
      : null;
  const currentQuestionSection =
    currentQuestion ? getQuestionSectionForQuestion(currentQuestion.subject, currentQuestion.sourceQuestionNumber) : null;
  const currentQuestionChoices =
    currentQuestion && session ? orderQuestionChoices(currentQuestion, session.choiceOrders?.[currentQuestion.id]) : [];

  const overallStats = useMemo(() => {
    const allStats = Object.values(study.stats);
    const attempts = allStats.reduce((sum, item) => sum + item.attempts, 0);
    const correct = allStats.reduce((sum, item) => sum + item.correct, 0);
    const favorites = allStats.filter((item) => item.starred).length;
    return {
      attempts,
      correct,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
      favorites,
    };
  }, [study]);

  const subjectStats = useMemo(() => {
    const stats = subjectQuestions.map((question) => getStats(study, question.id));
    const attempts = stats.reduce((sum, item) => sum + item.attempts, 0);
    const correct = stats.reduce((sum, item) => sum + item.correct, 0);
    const mistakes = stats.filter((item) => item.lastResult === "wrong").length;
    const favorites = stats.filter((item) => item.starred).length;
    return {
      totalQuestions: subjectQuestions.length,
      attempts,
      correct,
      mistakes,
      favorites,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    };
  }, [study, subjectQuestions]);

  const sessionStats = useMemo(() => {
    if (!session) {
      return { checked: 0, correct: 0, wrong: 0 };
    }

    const answers = session.questionIds.map((id) => {
      const answer = session.answers[id];
      const question = questionsById[id];
      return {
        checked: answer?.checked ?? false,
        correct: answer && question ? isCorrectAnswer(answer.selected, question.correctChoices) : false,
      };
    });

    const checked = answers.filter((item) => item.checked).length;
    const correct = answers.filter((item) => item.checked && item.correct).length;
    return { checked, correct, wrong: checked - correct };
  }, [questionsById, session]);

  function openSubject(nextSubject: Subject) {
    setSubject(nextSubject);
    setView("subject");
  }

  function getQuestionPool(nextSubject: Subject, sectionId?: string | null) {
    const basePool = nextSubject === "biology" ? biologyStudyQuestions : chemistryStudyQuestions;
    const section = getQuestionSection(sectionId ?? null);

    if (!section || section.subject !== nextSubject) {
      return basePool;
    }

    return basePool.filter((question) => questionIsInSection(question.sourceQuestionNumber, section));
  }

  function startSession(mode: Mode, options?: { subject?: Subject; sectionId?: string | null }) {
    const nextSubject = options?.subject ?? subject;
    const nextSectionId = options?.sectionId ?? null;
    const pool = getQuestionPool(nextSubject, nextSectionId);
    const questionIds = buildQuestionIds(mode, pool, study);

    startTransition(() => {
      setSubject(nextSubject);
      setSession({
        subject: nextSubject,
        mode,
        sectionId: nextSectionId,
        questionIds,
        choiceOrders: buildChoiceOrders(questionIds, questionsById),
        index: 0,
        answers: {},
      });
      setView("session");
    });
  }

  function updateAnswer(next: SessionAnswer) {
    if (!session || !currentQuestion) return;
    setSession({
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: next,
      },
    });
  }

  function toggleChoice(choice: ChoiceKey) {
    if (!currentAnswer || currentAnswer.checked) return;
    const nextSelected = currentAnswer.selected.includes(choice)
      ? currentAnswer.selected.filter((item) => item !== choice)
      : sortChoices([...currentAnswer.selected, choice]);
    updateAnswer({ ...currentAnswer, selected: nextSelected });
  }

  function commitResult(question: Question, answer: SessionAnswer) {
    const result = isCorrectAnswer(answer.selected, question.correctChoices);
    const today = getTodayKey();
    setStudy((current) => {
      const stats = getStats(current, question.id);
      return {
        stats: {
          ...current.stats,
          [question.id]: {
            ...stats,
            attempts: stats.attempts + 1,
            correct: stats.correct + (result ? 1 : 0),
            lastResult: result ? "correct" : "wrong",
          },
        },
        studyDates: current.studyDates.includes(today) ? current.studyDates : [...current.studyDates, today],
      };
    });
  }

  function checkAnswer() {
    if (!currentQuestion || !currentAnswer || currentAnswer.checked || currentAnswer.selected.length === 0) return;
    updateAnswer({ ...currentAnswer, checked: true });
    commitResult(currentQuestion, currentAnswer);
  }

  function toggleStar() {
    if (!currentQuestion) return;
    setStudy((current) => {
      const stats = getStats(current, currentQuestion.id);
      return {
        ...current,
        stats: {
          ...current.stats,
          [currentQuestion.id]: {
            ...stats,
            starred: !stats.starred,
          },
        },
      };
    });
  }

  function finishSession() {
    if (!session) return;
    const nextAnswers = { ...session.answers };
    for (const id of session.questionIds) {
      const answer = nextAnswers[id];
      const question = questionsById[id];
      if (!answer || !question || answer.checked) continue;
      if (answer.selected.length > 0) {
        commitResult(question, answer);
      }
      nextAnswers[id] = { ...answer, checked: true };
    }
    setSession({ ...session, answers: nextAnswers });
    setView("results");
  }

  function goBack() {
    if (view === "subject") {
      setView("home");
      return;
    }

    if (view === "pdfSections") {
      setView("subject");
      return;
    }

    if (view === "session" || view === "results") {
      if (session?.mode === "sequence" && getQuestionSections(session.subject).length > 0) {
        setSubject(session.subject);
        setView("pdfSections");
        return;
      }

      setView("subject");
    }
  }

  const selectedCorrect =
    currentQuestion && currentAnswer ? isCorrectAnswer(currentAnswer.selected, currentQuestion.correctChoices) : false;

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="topbarInner">
          <button className="brandButton" onClick={() => setView("home")} type="button">
            <span className="brandIcon">🎓</span>
            <span className="brandName">MedTest</span>
          </button>

          {view !== "home" ? (
            <button className="backButton" onClick={goBack} type="button">
              ← Späť
            </button>
          ) : null}
        </div>
      </header>

      <div className="pageWrap">
        {view === "home" ? (
          <section className="homeView">
            <div className="heroBlock">
              <h1>
                Testovnice z <span>medicíny</span>
              </h1>
              <p>Vyber si predmet a precvič si vedomosti cez tréning, náhodný test aj opakovanie chýb.</p>
            </div>

            <div className="subjectGrid">
              <button className="subjectCard" onClick={() => openSubject("biology")} type="button">
                <div className="subjectIcon">{subjectEmoji("biology")}</div>
                <div className="subjectContent">
                  <strong>Biológia</strong>
                  <span>{subjectDescription("biology")}</span>
                  <small>{biologyQuestions.length} otázok</small>
                </div>
              </button>

              <button className="subjectCard" onClick={() => openSubject("chemistry")} type="button">
                <div className="subjectIcon">{subjectEmoji("chemistry")}</div>
                <div className="subjectContent">
                  <strong>Chémia</strong>
                  <span>{subjectDescription("chemistry")}</span>
                  <small>{chemistryQuestions.length} otázok</small>
                </div>
              </button>
            </div>

            <div className="homeStats">
              <article className="statCard">
                <span>Spolu otázok</span>
                <strong>{questions.length}</strong>
              </article>
              <article className="statCard">
                <span>Vyhodnotených pokusov</span>
                <strong>{overallStats.attempts}</strong>
              </article>
              <article className="statCard">
                <span>Úspešnosť</span>
                <strong>{overallStats.accuracy}%</strong>
              </article>
              <article className="statCard">
                <span>Obľúbené</span>
                <strong>{overallStats.favorites}</strong>
              </article>
            </div>
          </section>
        ) : null}

        {view === "subject" ? (
          <section className="subjectView">
            <div className="subjectHeader">
              <div className="subjectHeaderIcon">{subjectEmoji(subject)}</div>
              <div className="subjectHeaderContent">
                <h2>{subjectLabel(subject)}</h2>
                <p>{subjectDescription(subject)}</p>
              </div>
            </div>

            <div className="subjectStats">
              <article className="statCard">
                <span>Otázky</span>
                <strong>{subjectStats.totalQuestions}</strong>
              </article>
              <article className="statCard">
                <span>Chyby na review</span>
                <strong>{subjectStats.mistakes}</strong>
              </article>
              <article className="statCard">
                <span>Úspešnosť</span>
                <strong>{subjectStats.accuracy}%</strong>
              </article>
              <article className="statCard">
                <span>Obľúbené</span>
                <strong>{subjectStats.favorites}</strong>
              </article>
            </div>

            <div className="featureList">
              {subjectQuestionSections.length > 0 ? (
                <button className="featureCard" onClick={() => setView("pdfSections")} type="button">
                  <div className="featureIcon">🧭</div>
                  <div className="featureContent">
                    <strong>Okruhy</strong>
                    <span>Rozklikni si okruhy predmetu a prejdi otázky presne v poradí, ako sú v PDF.</span>
                  </div>
                  <span className="featureArrow">›</span>
                </button>
              ) : null}

              <button className="featureCard" onClick={() => startSession("practice")} type="button">
                <div className="featureIcon">📘</div>
                <div className="featureContent">
                  <strong>Denný tréning</strong>
                  <span>20 miešaných otázok s okamžitou kontrolou odpovedí.</span>
                </div>
                <span className="featureArrow">›</span>
              </button>

              <button className="featureCard" onClick={() => startSession("exam50")} type="button">
                <div className="featureIcon">📝</div>
                <div className="featureContent">
                  <strong>Náhodný test 100</strong>
                  <span>Ostrý blok z náhodne vybraných otázok daného predmetu.</span>
                </div>
                <span className="featureArrow">›</span>
              </button>

              <button className="featureCard" onClick={() => startSession("mistakes")} type="button">
                <div className="featureIcon">🔁</div>
                <div className="featureContent">
                  <strong>Opakovanie chýb</strong>
                  <span>Vracia otázky, ktoré si naposledy pokazil.</span>
                </div>
                <span className="featureArrow">›</span>
              </button>

              <button className="featureCard" onClick={() => startSession("favorites")} type="button">
                <div className="featureIcon">⭐</div>
                <div className="featureContent">
                  <strong>Obľúbené otázky</strong>
                  <span>Osobný set otázok, ktoré si chceš opakovať častejšie.</span>
                </div>
                <span className="featureArrow">›</span>
              </button>
            </div>
          </section>
        ) : null}

        {view === "pdfSections" ? (
          <section className="subjectView">
            <div className="subjectHeader">
              <div className="subjectHeaderIcon">{subjectEmoji(subject)}</div>
              <div className="subjectHeaderContent">
                <h2>{subjectLabel(subject)} - Okruhy</h2>
                <p>Vyber si celok a spustí sa tréning zaradom presne podľa poradia v PDF.</p>
              </div>
            </div>

            <section className="sectionPanel">
              <div className="sectionPanelHeader">
                <div>
                  <h3>Celky</h3>
                  <p>Každá karta zodpovedá jednému okruhu v PDF. Po kliknutí pôjdu otázky zaradom podľa PDF.</p>
                </div>
                <button className="ghostAction" onClick={() => startSession("sequence")} type="button">
                  Spustiť všetky otázky zaradom
                </button>
              </div>

              <div className="sectionGrid">
                {subjectQuestionSections.map((section) => (
                  <button
                    key={section.id}
                    className="sectionCard"
                    onClick={() => startSession("sequence", { sectionId: section.id })}
                    type="button"
                  >
                    <span className="sectionRange">Otázky {formatQuestionRange(section)}</span>
                    <strong>{section.label}</strong>
                    <small>Prejsť otázky zaradom podľa PDF</small>
                  </button>
                ))}
              </div>
            </section>
          </section>
        ) : null}

        {view === "session" && session && currentQuestion && currentAnswer ? (
          <section className="sessionView">
            <div className="sessionHeader">
              <div>
                <p className="sessionEyebrow">
                  {subjectLabel(session.subject)}
                  {sessionSection ? ` · ${sessionSection.label}` : ""}
                  {" · "}
                  {modeLabel(session.mode)}
                </p>
                <h2>
                  Otázka {session.index + 1} z {session.questionIds.length}
                </h2>
              </div>
              <div className="sessionMeta">
                <span>{sessionStats.checked} vyhodnotených</span>
                <span>{sessionStats.correct} správne</span>
              </div>
            </div>

            <div className="progressTrack">
              <span
                style={{
                  width: `${session.questionIds.length > 0 ? Math.round((sessionStats.checked / session.questionIds.length) * 100) : 0}%`,
                }}
              />
            </div>

            <article className="questionSurface">
              <div className="questionTop">
                <div className="pillRow">
                  <span className="pill">{subjectLabel(currentQuestion.subject)}</span>
                  {currentQuestionSection ? <span className="pill mutedPill">{currentQuestionSection.label}</span> : null}
                  <span className="pill mutedPill">#{currentQuestion.sourceQuestionNumber}</span>
                </div>
                <button
                  className={currentStats.starred ? "starButton active" : "starButton"}
                  onClick={toggleStar}
                  type="button"
                >
                  Obľúbená
                </button>
              </div>

              <h3>{currentQuestion.prompt}</h3>

              <div className="answersList">
                {currentQuestionChoices.map((choice) => (
                  <button
                    key={choice.key}
                    className={`answerCard ${
                      !currentAnswer.checked && currentAnswer.selected.includes(choice.key)
                        ? "selected"
                        : currentAnswer.checked && currentQuestion.correctChoices.includes(choice.key)
                          ? "correct"
                          : currentAnswer.checked && currentAnswer.selected.includes(choice.key)
                            ? "wrong"
                            : ""
                    }`.trim()}
                    onClick={() => toggleChoice(choice.key)}
                    type="button"
                  >
                    <span className="answerKey">{choice.key}</span>
                    <span>{choice.text}</span>
                  </button>
                ))}
              </div>

              <div className="sessionActions">
                <button
                  className="secondaryAction"
                  disabled={session.index === 0}
                  onClick={() => setSession({ ...session, index: Math.max(0, session.index - 1) })}
                  type="button"
                >
                  Predchádzajúca
                </button>
                <button
                  className="primaryAction"
                  disabled={currentAnswer.selected.length === 0 || currentAnswer.checked}
                  onClick={checkAnswer}
                  type="button"
                >
                  {session.mode === "exam50" ? "Uložiť odpoveď" : "Skontrolovať"}
                </button>
                <button
                  className="secondaryAction"
                  disabled={session.index === session.questionIds.length - 1}
                  onClick={() =>
                    setSession({
                      ...session,
                      index: Math.min(session.questionIds.length - 1, session.index + 1),
                    })
                  }
                  type="button"
                >
                  Ďalšia
                </button>
              </div>

              {currentAnswer.checked ? (
                <div className={`feedbackBox ${selectedCorrect ? "ok" : "bad"}`}>
                  <strong>{selectedCorrect ? "Správne" : "Nesprávne"}</strong>
                  <span>Správna odpoveď: {sortChoices(currentQuestion.correctChoices).join(", ")}</span>
                </div>
              ) : null}
            </article>

            <div className="bottomActions">
              <button className="ghostAction" onClick={finishSession} type="button">
                Ukončiť a vyhodnotiť
              </button>
            </div>
          </section>
        ) : null}

        {view === "results" && session ? (
          <section className="resultsView">
            <div className="resultHero">
              <p>
                {subjectLabel(session.subject)}
                {sessionSection ? ` · ${sessionSection.label}` : ""}
                {" · "}
                {modeLabel(session.mode)}
              </p>
              <h2>Výsledok testu</h2>
            </div>

            <div className="subjectStats">
              <article className="statCard">
                <span>Skóre</span>
                <strong>
                  {session.questionIds.length > 0
                    ? Math.round((sessionStats.correct / session.questionIds.length) * 100)
                    : 0}
                  %
                </strong>
              </article>
              <article className="statCard">
                <span>Správne</span>
                <strong>{sessionStats.correct}</strong>
              </article>
              <article className="statCard">
                <span>Chyby</span>
                <strong>{sessionStats.wrong}</strong>
              </article>
            </div>

            <div className="bottomActions">
              <button
                className="primaryAction"
                onClick={() =>
                  startSession(session.mode, {
                    subject: session.subject,
                    sectionId: session.sectionId ?? null,
                  })
                }
                type="button"
              >
                Spustiť podobný blok znovu
              </button>
              <button className="secondaryAction" onClick={goBack} type="button">
                Späť
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
