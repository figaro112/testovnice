import QuizClient from "./quiz-client";
import { psychologyQuestions } from "../lib/psychology-questions";

export default function HomePage() {
  return <QuizClient questions={psychologyQuestions} />;
}
