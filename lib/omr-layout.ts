export const OMR_PAGE_WIDTH = 794;
export const OMR_PAGE_HEIGHT = 1123;
export const OMR_MARKER_CENTERS = [
  { x: 39, y: 39 },
  { x: 755, y: 39 },
  { x: 755, y: 1084 },
  { x: 39, y: 1084 },
] as const;

export const OMR_GRID = {
  left: 53,
  top: 288,
  tableWidth: 335,
  columnGap: 20,
  questionColumnWidth: 32,
  headerHeight: 18,
  rowTop: 307,
  rowHeight: 14,
  rowsPerColumn: 50,
  choicesWidth: 301,
} as const;

export function getOmrBubbleCenter(questionNumber: number, choiceIndex: number, choiceCount: number) {
  if (!Number.isInteger(questionNumber) || questionNumber < 1 || questionNumber > 100) {
    throw new RangeError("OMR question number must be between 1 and 100");
  }
  if (!Number.isInteger(choiceCount) || choiceCount < 4 || choiceCount > 5) {
    throw new RangeError("OMR choice count must be 4 or 5");
  }
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choiceCount) {
    throw new RangeError("OMR choice index is outside the configured choices");
  }

  const zeroBased = questionNumber - 1;
  const column = Math.floor(zeroBased / OMR_GRID.rowsPerColumn);
  const row = zeroBased % OMR_GRID.rowsPerColumn;
  const tableLeft = OMR_GRID.left + column * (OMR_GRID.tableWidth + OMR_GRID.columnGap);
  return {
    x: tableLeft + OMR_GRID.questionColumnWidth + ((choiceIndex + 0.5) * OMR_GRID.choicesWidth) / choiceCount,
    y: OMR_GRID.rowTop + row * OMR_GRID.rowHeight + OMR_GRID.rowHeight / 2,
  };
}
