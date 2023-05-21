import { useCallback, useEffect, useMemo, useState } from "react";
import classNames from "clsx";
import {
  SettingsIcon,
  MicIcon,
  HeadphonesIcon,
  LanguagesIcon,
} from "lucide-react";

import { pick } from "../lib/system";

import { buildMainURL } from "../config/extUrl";
import { RecordType, TabInfo } from "../core/types";
import { TabRecordState, getTabRecordState, toTabKey } from "../core/session";

import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import History from "./History";
import TabAvatar from "./TabAvatar";
import RecordSpinner from "./RecordSpinner";
import ControlButtons from "./ControlButtons";

export default function Popup() {
  return (
    <>
      <PopupHeader />
      <PopupActions />
      <History />
    </>
  );
}

function PopupHeader() {
  return (
    <header className="mb-4">
      <nav className="p-4 flex items-center">
        <div className="flex items-center mr-4">
          <img src="/icon-128.png" alt="" className="h-10 w-auto" />
          <span className="ml-3 font-semibold text-xl">Meeper</span>
        </div>

        <div className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          className="text-lg font-semibold text-muted-foreground"
          onClick={() =>
            chrome.tabs.create({
              url: buildMainURL("/settings"),
              active: true,
            })
          }
        >
          <SettingsIcon className="h-6 w-auto mr-2" />
          Settings
        </Button>
      </nav>
    </header>
  );
}

function PopupActions() {
  const [processing, setProcessing] = useState(false);
  const [session, setSession] = useState<TabRecordState>();
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab>();
  const [recordType, setRecordType] = useState<RecordType>(
    RecordType.StereoOnly
  );

  const transcribing = Boolean(session);

  const tabInfo = useMemo(
    () =>
      activeTab &&
      (pick(activeTab, "id", "url", "title", "favIconUrl") as TabInfo),
    [activeTab]
  );

  const load = useCallback(async () => {
    const tab = await getActiveTab();
    if (!tab) throw new Error("Failed to detect current tab");

    const rt = matchRecordType(tab);
    const session = await getTabRecordState({ tabId: tab.id! });

    setActiveTab(tab);
    setRecordType(rt);
    setSession(session);
  }, [setActiveTab, setRecordType]);

  useEffect(() => {
    if (!session) return;

    const handleSessionChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const storageKey = toTabKey(session);
      if (storageKey in changes) {
        setSession(changes[storageKey].newValue);
      }
    };

    chrome.storage.session.onChanged.addListener(handleSessionChange);
    return () =>
      chrome.storage.session.onChanged.removeListener(handleSessionChange);
  }, [session]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const startRecord = useCallback(async () => {
    if (processing) return;
    setProcessing(true);

    try {
      if (!activeTab) throw new Error("Failed to detect current tab");

      if (!session) {
        await record(activeTab, recordType);
      } else {
        await chrome.tabs
          .update(session.recordTabId, { active: true })
          .catch(console.error);
      }

      await new Promise((r) => setTimeout(r, 300));
      window.close();
    } catch (err: any) {
      console.error(err);
      alert(err?.message);
    }

    setProcessing(false);
  }, [setProcessing, processing, activeTab, recordType, session]);

  const sendCommand = useCallback(
    (type: string) => {
      if (!session) return;

      chrome.runtime.sendMessage({ recordId: session.recordId, type });

      if (type === "stop") {
        setProcessing(true);

        setTimeout(() => {
          setSession(undefined);
          setProcessing(false);
        }, 2_000);
      }
    },
    [session, setSession]
  );

  return (
    <main className="mb-8 flex flex-col px-4">
      <div
        className={classNames(
          "rounded-lg border bg-card text-card-foreground shadow-sm",
          "w-full h-44 text-left",
          "flex flex-col justify-between",
          "min-w-0"
        )}
      >
        {tabInfo && (
          <>
            <div className="flex items-center px-4 py-1 bg-muted shadow-inset-bottom">
              <TabAvatar tab={tabInfo} className="mr-2 border-none" />

              <div className="flex items-center justify-end w-full min-w-0">
                <div className="truncate mr-auto text-base font-semibold leading-snug">
                  {tabInfo.title}
                </div>
              </div>
            </div>

            <p className="px-4 pb-1 prose prose-slate leading-snug opacity-75">
              <span>Transcribe any audio 🔉 from this browser 📑</span>
              <br />
              <span className="">tab on the fly! ⚡️</span>
            </p>

            <div className="flex items-end justify-between px-4 pb-3">
              <Button type="button" onClick={startRecord} disabled={processing}>
                {!transcribing ? (
                  <>
                    <LanguagesIcon className="h-4 w-auto mr-2" />
                    Start transcription
                  </>
                ) : (
                  <>
                    <RecordSpinner className="mr-2" />
                    Open
                  </>
                )}
              </Button>

              {!transcribing ? (
                <Select
                  value={recordType}
                  onValueChange={(v) => setRecordType(v as RecordType)}
                >
                  <SelectTrigger className="w-auto h-8">
                    <SelectValue placeholder="Type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={RecordType.Full}>
                      <span
                        className={classNames(
                          "mr-1",
                          "inline-flex items-center",
                          "text-xs text-foreground"
                        )}
                      >
                        <MicIcon className="h-3 w-auto mr-0.5" />
                        <HeadphonesIcon className="h-3 w-auto mr-1.5" />
                        <span>Meeting</span>
                      </span>
                    </SelectItem>
                    <SelectItem value={RecordType.StereoOnly}>
                      <span
                        className={classNames(
                          "mr-1",
                          "inline-flex items-center",
                          "text-xs text-foreground"
                        )}
                      >
                        <HeadphonesIcon className="h-3 w-auto mr-1.5" />
                        <span>Audio only</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                !processing && (
                  <div className="flex items-center">
                    <ControlButtons
                      streamActive={true}
                      recording={session!.recording}
                      start={() => sendCommand("start")}
                      pause={() => sendCommand("pause")}
                      stop={() => sendCommand("stop")}
                    />
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function matchRecordType(tab: chrome.tabs.Tab) {
  const meetLikeEntries = ["teams.live", "meet.google", "zoom"];

  if (meetLikeEntries.some((entry) => tab.url?.includes(entry))) {
    return RecordType.Full;
  }

  return RecordType.StereoOnly;
}

async function record(tab: chrome.tabs.Tab, recordType: RecordType) {
  if (tab.url?.includes(chrome.runtime.id))
    throw new Error("Cannot start on Meeper Tab");

  await chrome.runtime.sendMessage({
    type: "init",
    recordType,
    tabId: tab.id,
    tabIndex: tab.index,
  });
}

async function getActiveTab() {
  const [activeTab] = await chrome.tabs.query({
    currentWindow: true,
    active: true,
  });

  return activeTab;
}
