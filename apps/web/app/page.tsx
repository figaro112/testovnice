import QuizClient from "./quiz-client";
import biologyQuestions from "../../../packages/question-bank/data/normalized/biology.questions.json";
import chemistryQuestions from "../../../packages/question-bank/data/normalized/chemistry.questions.json";
import type { QuestionItem } from "@testovnice/question-bank/src/types";

export default function HomePage() {
  return (
    <QuizClient
      biologyQuestions={biologyQuestions as QuestionItem[]}
      chemistryQuestions={chemistryQuestions as QuestionItem[]}
    />
  );
}
