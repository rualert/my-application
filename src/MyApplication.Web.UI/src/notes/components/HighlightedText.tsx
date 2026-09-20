import { Mark } from "@mantine/core";
import { Fragment } from "react";
import type { HighlightedSegment } from "../../api/types";

interface HighlightedTextProps {
  segments: HighlightedSegment[];
}

/**
 * Выводит размеченную сервером строку: места совпадений с поисковым запросом —
 * на жёлтом фоне, остальное — как есть.
 */
export function HighlightedText({ segments }: HighlightedTextProps) {
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment.match ? <Mark color="yellow">{segment.text}</Mark> : segment.text}
        </Fragment>
      ))}
    </>
  );
}
