import { describe, expect, it } from "vitest";
import { isUntitled, titleForRequest } from "./domain";

describe("titleForRequest", () => {
  it.each([[""], ["   "], ["\t\n"]])("sends an empty or whitespace-only title (%j) as null", (draftTitle) => {
    // Arrange

    // Act
    const title = titleForRequest(draftTitle);

    // Assert
    expect(title).toBeNull();
  });

  it("sends a real title as is, without trimming", () => {
    // Arrange
    const draftTitle = "  Список дел ";

    // Act
    const title = titleForRequest(draftTitle);

    // Assert
    expect(title).toBe("  Список дел ");
  });
});

describe("isUntitled", () => {
  it.each([[null], [""], ["   "]])("treats %j as untitled", (title) => {
    // Arrange

    // Act
    const untitled = isUntitled(title);

    // Assert
    expect(untitled).toBe(true);
  });

  it("treats a real title as titled", () => {
    // Arrange

    // Act
    const untitled = isUntitled("Список дел");

    // Assert
    expect(untitled).toBe(false);
  });
});
