export type SubjectCode = "biology" | "chemistry";

export type ChoiceKey = "A" | "B" | "C" | "D";

export interface AnswerKeyEntry {
  questionNumber: number;
  correctChoices: ChoiceKey[];
}

export interface QuestionChoice {
  key: ChoiceKey;
  text: string;
}

export interface QuestionItem {
  id: string;
  sourceQuestionNumber: number;
  subject: SubjectCode;
  prompt: string;
  choices: QuestionChoice[];
  correctChoices: ChoiceKey[];
  explanation?: string;
  tags?: string[];
}

export interface ImportManifest {
  sourceFileName: string;
  importedAt: string;
  pageCount: number;
  sections: string[];
}

