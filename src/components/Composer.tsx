"use client";

import { useLayoutEffect, useRef, type FormEvent } from "react";
import { models } from "@/lib/models";
import Icon from "./Icon";

type Props = {
  value: string; onChange: (value: string) => void; onSubmit: () => void;
  model: string; onModelChange: (model: string) => void;
  busy?: boolean; disabled?: boolean; onStop?: () => void; autoFocus?: boolean;
};

export default function Composer({ value, onChange, onSubmit, model, onModelChange, busy = false, disabled = false, onStop, autoFocus }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px";
    }
  }, [value]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!busy && !disabled && value.trim()) { onSubmit(); inputRef.current?.focus(); }
  };
  return <form className="composer" onSubmit={submit}>
    <textarea ref={inputRef} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
      placeholder="向 DeepSeek 提问" aria-label="输入消息" autoFocus={autoFocus} rows={1} maxLength={100000}
      onKeyDown={event => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault(); submit();
        }
      }} />
    <div className="composer-toolbar">
      <label className="model-picker"><Icon name="spark" width={16} height={16} /><span className="sr-only">选择模型</span>
        <select value={model} onChange={event => onModelChange(event.target.value)} disabled={busy || disabled}>
          {models.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select><Icon name="chevron" width={14} height={14} />
      </label>
      {busy && onStop ? <button type="button" className="send-button" onClick={onStop} title="停止生成" aria-label="停止生成"><Icon name="stop" width={17} height={17} /></button>
        : <button type="submit" className="send-button" disabled={!value.trim() || busy || disabled} title="发送消息" aria-label="发送消息">{busy ? <span className="button-spinner" /> : <Icon name="arrow" />}</button>}
    </div>
  </form>;
}
