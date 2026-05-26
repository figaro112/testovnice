"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import {
  exampleTestQuestionCount,
  topics,
  type ChoiceKey,
  type PsychologyQuestion,
  type TopicId,
} from "../lib/psychology-questions";

type Mode = "quick" | "exam" | "all" | "mistakes" | "topic";
type View = "home" | "session" | "results";

type QuestionProgress = {
  attempts: number;
  correct: number;
  lastResult: "correct" | "wrong";
};

type StudyState = Record<string, QuestionProgress>;

type SessionAnswer = {
  selected: ChoiceKey | null;
  checked: boolean;
  correct: boolean;
};

type Session = {
  mode: Mode;
  topicId?: TopicId;
  questionIds: string[];
  index: number;
  answers: Record<string, SessionAnswer>;
};

type Props = {
  questions: PsychologyQuestion[];
};

const STORAGE_KEY = "psychotest.study.v1";

function shuffle<T>(values: T[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function modeLabel(mode: Mode) {
  if (mode === "quick") return "Rýchly tréning";
  if (mode === "exam") return "Skúšobný test";
  if (mode === "all") return "Všetky otázky";
  if (mode === "mistakes") return "Opakovanie chýb";
  return "Vybraný okruh";
}

function resultClass(answer: SessionAnswer | undefined, choice: ChoiceKey, correct: ChoiceKey) {
  if (!answer?.checked) return answer?.selected === choice ? "selected" : "";
  if (choice === correct) return "correct";
  return answer.selected === choice ? "wrong" : "";
}

export default function QuizClient({ questions }: Props) {
  const [view, setView] = useState<View>("home");
  const [study, setStudy] = useState<StudyState>({});
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  const questionsById = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, question])) as Record<string, PsychologyQuestion>,
    [questions],
  );

  const questionCounts = useMemo(
    () =>
      Object.fromEntries(
        topics.map((topic) => [topic.id, questions.filter((question) => question.topic === topic.id).length]),
      ) as Record<TopicId, number>,
    [questions],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setStudy(JSON.parse(stored) as StudyState);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(study));
    }
  }, [ready, study]);

  const progress = useMemo(() => {
    const attempts = Object.values(study).reduce((sum, item) => sum + item.attempts, 0);
    const correct = Object.values(study).reduce((sum, item) => sum + item.correct, 0);
    const mistakes = Object.values(study).filter((item) => item.lastResult === "wrong").length;
    return {
      attempts,
      correct,
      mistakes,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
    };
  }, [study]);

  const currentQuestion = session ? questionsById[session.questionIds[session.index]] : null;
  const currentAnswer = currentQuestion && session ? session.answers[currentQuestion.id] : undefined;
  const sessionChecked = session
    ? Object.values(session.answers).filter((answer) => answer.checked).length
    : 0;
  const sessionCorrect = session
    ? Object.values(session.answers).filter((answer) => answer.checked && answer.correct).length
    : 0;

  function startSession(mode: Mode, topicId?: TopicId) {
    const basePool = topicId ? questions.filter((question) => question.topic === topicId) : questions;
    const mistakePool = basePool.filter((question) => study[question.id]?.lastResult === "wrong");
    const pool = mode === "mistakes" && mistakePool.length ? mistakePool : basePool;
    const amount = mode === "quick" ? 15 : mode === "exam" ? 25 : pool.length;
    const orderedPool = mode === "all" ? pool : shuffle(pool);
    const questionIds = orderedPool.slice(0, Math.min(amount, pool.length)).map((question) => question.id);

    startTransition(() => {
      setSession({ mode, topicId, questionIds, index: 0, answers: {} });
      setView("session");
    });
  }

  function chooseAnswer(key: ChoiceKey) {
    if (!session || !currentQuestion || currentAnswer?.checked) return;
    setSession({
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: { selected: key, checked: false, correct: false },
      },
    });
  }

  function checkAnswer() {
    if (!session || !currentQuestion || !currentAnswer?.selected || currentAnswer.checked) return;
    const isCorrect = currentAnswer.selected === currentQuestion.correct;

    setSession({
      ...session,
      answers: {
        ...session.answers,
        [currentQuestion.id]: { ...currentAnswer, checked: true, correct: isCorrect },
      },
    });
    setStudy((previous) => {
      const prior = previous[currentQuestion.id] ?? { attempts: 0, correct: 0, lastResult: "wrong" as const };
      return {
        ...previous,
        [currentQuestion.id]: {
          attempts: prior.attempts + 1,
          correct: prior.correct + (isCorrect ? 1 : 0),
          lastResult: isCorrect ? "correct" : "wrong",
        },
      };
    });
  }

  function moveNext() {
    if (!session) return;
    if (session.index === session.questionIds.length - 1) {
      setView("results");
      return;
    }
    setSession({ ...session, index: session.index + 1 });
  }

  function resetHome() {
    setView("home");
    setSession(null);
  }

  const sessionTopic = session?.topicId ? topics.find((topic) => topic.id === session.topicId) : null;
  const activeTopic = currentQuestion ? topics.find((topic) => topic.id === currentQuestion.topic) : null;
  const resultPercent = sessionChecked ? Math.round((sessionCorrect / sessionChecked) * 100) : 0;

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="topbarInner">
          <button className="brandButton" onClick={resetHome} type="button">
            <span className="brandMark" aria-hidden="true">
              Ψ
            </span>
            <span>PsychoTest</span>
          </button>
          {view !== "home" ? (
            <button className="backButton" onClick={resetHome} type="button">
              Ukončiť
            </button>
          ) : (
            <span className="headerCount">{questions.length} otázok</span>
          )}
        </div>
      </header>

      {view === "home" ? (
        <div className="pageWrap homeView">
          <section className="heroBlock">
            <p className="courseName">Kvantitatívna analýza v psychológii</p>
            <h1>
              Trénuj otázky <span>ako na teste.</span>
            </h1>
            <p className="heroText">
              Klikací test na mobile z prezentácií a odfotených príkladových otázok. Vyber jednu odpoveď a hneď si
              over vysvetlenie.
            </p>
          </section>

          <section className="modeGrid" aria-label="Režimy testovania">
            <button className="modeCard primaryMode" onClick={() => startSession("quick")} type="button">
              <strong>Rýchly tréning</strong>
              <span>15 miešaných otázok</span>
            </button>
            <button className="modeCard" onClick={() => startSession("exam")} type="button">
              <strong>Skúšobný test</strong>
              <span>25 otázok ako na zápočte</span>
            </button>
            <button
              className="modeCard"
              disabled={progress.mistakes === 0}
              onClick={() => startSession("mistakes")}
              type="button"
            >
              <strong>Opakovanie chýb</strong>
              <span>{progress.mistakes ? `${progress.mistakes} otázok na opravu` : "Aktivuje sa po prvej chybe"}</span>
            </button>
            <button className="modeCard allMode" onClick={() => startSession("all")} type="button">
              <strong>Všetky otázky za radom</strong>
              <span>{questions.length} otázok v poradí od začiatku po koniec</span>
            </button>
          </section>

          <section className="statsRail" aria-label="Pokrok">
            <article>
              <strong>{progress.attempts}</strong>
              <span>odpovedí</span>
            </article>
            <article>
              <strong>{progress.accuracy}%</strong>
              <span>úspešnosť</span>
            </article>
            <article>
              <strong>{exampleTestQuestionCount}</strong>
              <span>z fotiek testu</span>
            </article>
          </section>

          <section className="topicsSection">
            <div className="sectionHeading">
              <h2>Vyber si okruh</h2>
              <span>precvič celý blok</span>
            </div>
            <div className="topicList">
              {topics.map((topic) => (
                <button className="topicCard" key={topic.id} onClick={() => startSession("topic", topic.id)} type="button">
                  <div>
                    <strong>{topic.label}</strong>
                    <span>{topic.note}</span>
                  </div>
                  <small>{questionCounts[topic.id]}</small>
                </button>
              ))}
            </div>
          </section>

          <p className="sourceNote">
            Obsah: prezentácie, Word poznámky k témam 1 až 9 a zaslané fotografie príkladových testov. Harmonogram a
            úvodné stretnutie neobsahovali skúškové učivo pre otázky.
          </p>
        </div>
      ) : null}

      {view === "session" && session && currentQuestion ? (
        <div className="pageWrap sessionView">
          <div className="sessionHeading">
            <div>
              <span className="topicPill">{activeTopic?.label}</span>
              <p className="sessionCounter">
                Otázka {session.index + 1} z {session.questionIds.length}
              </p>
            </div>
            <strong className="liveScore">{sessionCorrect} správne</strong>
          </div>

          <div className="progressTrack" aria-label="Postup testom">
            <span style={{ width: `${((session.index + 1) / session.questionIds.length) * 100}%` }} />
          </div>

          <article className="questionSurface">
            <h2>{currentQuestion.prompt}</h2>
            <div className="answersList">
              {currentQuestion.choices.map((choice) => (
                <button
                  aria-pressed={currentAnswer?.selected === choice.key}
                  className={`answerCard ${resultClass(currentAnswer, choice.key, currentQuestion.correct)}`.trim()}
                  disabled={currentAnswer?.checked}
                  key={choice.key}
                  onClick={() => chooseAnswer(choice.key)}
                  type="button"
                >
                  <span className="answerKey">{choice.key.toLowerCase()}</span>
                  <span>{choice.text}</span>
                </button>
              ))}
            </div>

            {currentAnswer?.checked ? (
              <div className={currentAnswer.correct ? "feedbackBox ok" : "feedbackBox bad"}>
                <strong>{currentAnswer.correct ? "Správne." : `Nesprávne. Správna odpoveď je ${currentQuestion.correct.toLowerCase()}).`}</strong>
                <p>{currentQuestion.explanation}</p>
                <small>
                  Zdroj: {currentQuestion.source}
                  {currentQuestion.fromExampleTest ? " · podľa príkladového testu" : ""}
                </small>
              </div>
            ) : null}
          </article>

          <div className="actionDock">
            {currentAnswer?.checked ? (
              <button className="primaryAction" onClick={moveNext} type="button">
                {session.index === session.questionIds.length - 1 ? "Zobraziť výsledok" : "Ďalšia otázka"}
              </button>
            ) : (
              <button className="primaryAction" disabled={!currentAnswer?.selected} onClick={checkAnswer} type="button">
                Skontrolovať
              </button>
            )}
          </div>
        </div>
      ) : null}

      {view === "results" && session ? (
        <div className="pageWrap resultsView">
          <p className="courseName">
            {sessionTopic?.label ?? modeLabel(session.mode)}
          </p>
          <h1>Výsledok testu</h1>
          <div className="scoreCircle" aria-label={`Skóre ${resultPercent} percent`}>
            <strong>{resultPercent}%</strong>
            <span>{sessionCorrect} správne</span>
          </div>
          <p className="resultText">
            Vyhodnotil si {sessionChecked} z {session.questionIds.length} otázok. Chybné odpovede zostali uložené na
            ďalšie precvičenie.
          </p>
          <div className="resultActions">
            {progress.mistakes ? (
              <button className="primaryAction" onClick={() => startSession("mistakes")} type="button">
                Precvičiť chyby
              </button>
            ) : null}
            <button className="secondaryAction" onClick={() => startSession(session.mode, session.topicId)} type="button">
              Spustiť znova
            </button>
            <button className="ghostAction" onClick={resetHome} type="button">
              Domov
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
