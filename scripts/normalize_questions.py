from __future__ import annotations

import json
import re
import sys
from pathlib import Path


QUESTION_RE = re.compile(r"^(\d+)\.\s*(.*)$")
CHOICE_INLINE_RE = re.compile(r"^([ABCD])\.\s*(.*)$")
SUBJECT_RE = re.compile(r"LF - (Biológia|Chémia)")


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def clean_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip()


def load_answer_keys(answer_key_dir: Path) -> dict[str, dict[int, list[str]]]:
    answer_keys: dict[str, dict[int, list[str]]] = {"biology": {}, "chemistry": {}}
    for path in sorted(answer_key_dir.glob("*.json")):
        payload = read_json(path)
        subject = payload["subject"]
        for entry in payload["entries"]:
            answer_keys[subject][int(entry["questionNumber"])] = entry["correctChoices"]
    return answer_keys


def parse_questions_from_text(text: str, subject: str) -> list[dict[str, object]]:
    if "Správne odpovede" in text or "SprĂˇvneodpovede" in text.replace(" ", ""):
        return []

    lines = [clean_line(line) for line in text.splitlines()]
    lines = [line for line in lines if line]

    questions: list[dict[str, object]] = []
    current_question: dict[str, object] | None = None
    current_choice: str | None = None

    def append_to_prompt(value: str) -> None:
        nonlocal current_question
        if not current_question or not value:
            return
        prompt = str(current_question.get("prompt", ""))
        current_question["prompt"] = f"{prompt} {value}".strip()

    def append_to_choice(value: str) -> None:
        nonlocal current_question, current_choice
        if not current_question or not current_choice or not value:
            return
        choices = current_question["choices"]
        choices[current_choice] = f"{choices[current_choice]} {value}".strip()

    for raw_line in lines:
        if raw_line.startswith("Zoznam otázok z oblasti:"):
            continue
        if raw_line == ". strana":
            continue
        if raw_line.isdigit():
            continue

        subject_match = SUBJECT_RE.search(raw_line)
        if subject_match:
            continue

        question_match = QUESTION_RE.match(raw_line)
        if question_match:
            if current_question:
                questions.append(current_question)
            current_question = {
                "sourceQuestionNumber": int(question_match.group(1)),
                "subject": subject,
                "prompt": question_match.group(2).strip(),
                "choices": {"A": "", "B": "", "C": "", "D": ""},
            }
            current_choice = None
            continue

        choice_inline_match = CHOICE_INLINE_RE.match(raw_line)
        if choice_inline_match and current_question:
            current_choice = choice_inline_match.group(1)
            append_to_choice(choice_inline_match.group(2))
            continue

        if raw_line in {"A.", "B.", "C.", "D."} and current_question:
            current_choice = raw_line[0]
            continue

        if current_choice:
            append_to_choice(raw_line)
        else:
            append_to_prompt(raw_line)

    if current_question:
        questions.append(current_question)

    normalized_questions: list[dict[str, object]] = []
    for question in questions:
        normalized_questions.append(
            {
                "id": f"{subject}-{question['sourceQuestionNumber']}",
                "sourceQuestionNumber": question["sourceQuestionNumber"],
                "subject": subject,
                "prompt": re.sub(r"\s+", " ", str(question["prompt"])).strip(),
                "choices": [
                    {"key": key, "text": re.sub(r"\s+", " ", value).strip()}
                    for key, value in question["choices"].items()
                ],
            }
        )
    return normalized_questions


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    imports_root = repo_root / "packages" / "question-bank" / "data" / "imports"
    normalized_root = repo_root / "packages" / "question-bank" / "data" / "normalized"

    raw_pages_dir = imports_root / "raw-pages"
    answer_key_dir = imports_root / "answer-keys"

    if not raw_pages_dir.exists():
        print("Missing raw pages. Run import_pdf.py first.")
        return 1

    if not answer_key_dir.exists():
        print("Missing answer keys. Run import_pdf.py first.")
        return 1

    answer_keys = load_answer_keys(answer_key_dir)
    by_subject: dict[str, list[dict[str, object]]] = {"biology": [], "chemistry": []}

    for path in sorted(raw_pages_dir.glob("page-*.txt")):
        text = path.read_text(encoding="utf-8")
        normalized_page = re.sub(r"\s+", "", text)
        if "Správneodpovede-Biológia" in normalized_page or "SprĂˇvneodpovede-BiolĂłgia" in normalized_page:
            continue
        if "Správneodpovede-Chémia" in normalized_page or "SprĂˇvneodpovede-ChĂ©mia" in normalized_page:
            continue

        subject = None
        if "LF - Biológia" in text or "LF - BiolĂłgia" in text:
            subject = "biology"
        elif "LF - Chémia" in text or "LF - ChĂ©mia" in text:
            subject = "chemistry"

        if not subject:
            continue

        by_subject[subject].extend(parse_questions_from_text(text, subject))

    combined_questions: list[dict[str, object]] = []
    stats: dict[str, dict[str, int]] = {}

    for subject in ("biology", "chemistry"):
        questions = sorted(by_subject[subject], key=lambda item: int(item["sourceQuestionNumber"]))
        answer_map = answer_keys[subject]

        for question in questions:
            question["correctChoices"] = answer_map.get(int(question["sourceQuestionNumber"]), [])

        write_json(normalized_root / f"{subject}.questions.json", questions)

        matched = sum(1 for question in questions if question["correctChoices"])
        stats[subject] = {
            "questionCount": len(questions),
            "questionsWithAnswers": matched,
        }
        combined_questions.extend(questions)

    combined_questions.sort(key=lambda item: (str(item["subject"]), int(item["sourceQuestionNumber"])))
    write_json(normalized_root / "all.questions.json", combined_questions)
    write_json(
        normalized_root / "summary.json",
        {
            "subjects": stats,
            "totalQuestions": len(combined_questions),
        },
    )

    print(
        f"Normalized {len(by_subject['biology'])} biology and {len(by_subject['chemistry'])} chemistry questions."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
