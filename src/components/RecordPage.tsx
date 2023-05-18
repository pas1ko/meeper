import { useState, useEffect, ReactNode, useRef, useMemo } from "react";
import classNames from "clsx";

import RecordHeader from "./RecordHeader";
import { RecordType } from "../core/types";
import { MeeperRecorder, MeeperState, recordMeeper } from "../core/meeper";

export default function RecordPage({
  tabId,
  recordType,
}: {
  tabId: number;
  recordType: string;
}) {
  const meeperRef = useRef<MeeperRecorder>();
  const [meeperState, setMeeperState] = useState<MeeperState>();
  const [fatalError, setFatalError] = useState<ReactNode>();
  const [closing, setClosing] = useState(false);

  const meeper = meeperRef.current;
  const isActive = meeper?.stream.active;
  const { recording = false, content = [] } = meeperState ?? {};

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 👇️ scroll to bottom every time content change
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [content.length]);

  useEffect(() => {
    if (
      !tabId ||
      !recordType ||
      !Object.values(RecordType).includes(recordType as any)
    ) {
      window.close();
      return;
    }

    recordMeeper(tabId, recordType as RecordType, setMeeperState)
      .then((meeper) => {
        meeperRef.current = meeper;
      })
      .catch((err) => {
        console.error(err);
        setFatalError(err.message);
      });
  }, [tabId, recordType, setMeeperState, setFatalError]);

  useEffect(() => {
    // Handle stop
    if (meeper && !isActive) {
      setClosing(true);
      setTimeout(() => window.close(), 3_000);

      // getSummary(content)
      //   .then((summary) => {
      //     console.info(summary);
      //   })
      //   .catch(console.error);
    }
  }, [meeper, isActive]);

  useEffect(() => meeperRef.current?.stop, []);

  const headerRightSide = useMemo(() => {
    if (closing) {
      return <span className="text-sm text-muted-foreground">Saving...</span>;
    }

    if (meeper && isActive) {
      return (
        <>
          <button
            type="button"
            className={classNames(
              "px-2 py-1 text-lg font-semibold rounded-md border border-slate-200 mr-4"
            )}
            onClick={() => (recording ? meeper.pause() : meeper.start())}
          >
            {recording ? "Pause" : "Continue"}
          </button>

          <button
            type="button"
            className={classNames(
              "px-2 py-1 text-lg font-semibold rounded-md border border-slate-200"
            )}
            onClick={() => meeper.stop()}
          >
            Stop
          </button>
        </>
      );
    }

    return null;
  }, [closing, meeper, isActive, recording]);

  return (
    <div
      className={classNames(
        "min-h-screen flex flex-col",
        closing && "opacity-75 cursor-wait"
      )}
    >
      <RecordHeader recording={recording} meeper={meeper} />

      <main className="flex-1 container mx-auto max-w-3xl px-4 py-8 grow bg-white">
        <article className="prose prose-slate">
          {!fatalError ? (
            content.length > 0 ? (
              content.map((item, i) => <p key={i}>{item}</p>)
            ) : recording ? (
              "Recording..."
            ) : (
              "Loading..."
            )
          ) : (
            <p>
              <span className="text-red-600">Error!</span>
              <br />
              {fatalError}
            </p>
          )}
        </article>
      </main>

      <div ref={bottomRef} />
    </div>
  );
}
