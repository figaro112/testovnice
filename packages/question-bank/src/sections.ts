import type { SubjectCode } from "./types";

export interface QuestionSection {
  id: string;
  subject: SubjectCode;
  label: string;
  fromQuestion: number;
  toQuestion: number;
}

export const biologyQuestionSections: QuestionSection[] = [
  {
    id: "biology-as-science",
    subject: "biology",
    label: "Biológia ako veda",
    fromQuestion: 1,
    toQuestion: 207,
  },
  {
    id: "cell",
    subject: "biology",
    label: "Bunka",
    fromQuestion: 208,
    toQuestion: 332,
  },
  {
    id: "plants",
    subject: "biology",
    label: "Rastliny",
    fromQuestion: 333,
    toQuestion: 451,
  },
  {
    id: "genetics",
    subject: "biology",
    label: "Genetika",
    fromQuestion: 452,
    toQuestion: 643,
  },
  {
    id: "zoology",
    subject: "biology",
    label: "Zoológia",
    fromQuestion: 644,
    toQuestion: 783,
  },
  {
    id: "human",
    subject: "biology",
    label: "Človek",
    fromQuestion: 784,
    toQuestion: 1100,
  },
];

export const chemistryQuestionSections: QuestionSection[] = [
  {
    id: "anorganics",
    subject: "chemistry",
    label: "Anorganika",
    fromQuestion: 1,
    toQuestion: 354,
  },
  {
    id: "biochemistry",
    subject: "chemistry",
    label: "Biochémia",
    fromQuestion: 815,
    toQuestion: 1092,
  },
];

export function questionIsInSection(questionNumber: number, section: QuestionSection) {
  return questionNumber >= section.fromQuestion && questionNumber <= section.toQuestion;
}
