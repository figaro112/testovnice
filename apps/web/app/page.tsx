import QuizClient from "./quiz-client";
import biologyQuestions from "../../../packages/question-bank/data/normalized/biology.questions.json";
import chemistryQuestions from "../../../packages/question-bank/data/normalized/chemistry.questions.json";

export default function HomePage() {
  return (
    <QuizClient
      biologyQuestions={biologyQuestions}
      chemistryQuestions={chemistryQuestions}
    />
  );
}
