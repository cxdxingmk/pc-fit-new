"use client";

import { useId } from "react";
import { cn } from "./cn";
import type { CascadeItem, UseCascadingPartSelectResult } from "./useCascadingPartSelect";

const SELECT_CLASSES =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-600 dark:focus-visible:ring-offset-slate-900";

interface CascadingPartSelectProps<T extends CascadeItem> {
  title: string;
  brandLabel?: string;
  groupLabel?: string;
  modelLabel?: string;
  state: UseCascadingPartSelectResult<T>;
  renderModelLabel?: (item: T) => string;
  error?: string;
}

export default function CascadingPartSelect<T extends CascadeItem>({
  title,
  brandLabel = "브랜드",
  groupLabel = "시리즈",
  modelLabel = "모델",
  state,
  renderModelLabel,
  error,
}: CascadingPartSelectProps<T>) {
  const brandFieldId = useId();
  const groupFieldId = useId();
  const modelFieldId = useId();

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={brandFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            {brandLabel}
          </label>
          <select id={brandFieldId} value={state.brand} onChange={(event) => state.selectBrand(event.target.value)} className={cn(SELECT_CLASSES)}>
            <option value="">선택하세요</option>
            {state.brandOptions.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={groupFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            {groupLabel}
          </label>
          <select
            id={groupFieldId}
            value={state.group}
            onChange={(event) => state.selectGroup(event.target.value)}
            disabled={!state.brand}
            className={cn(SELECT_CLASSES)}
          >
            <option value="">{state.brand ? "선택하세요" : `먼저 ${brandLabel}를 선택하세요`}</option>
            {state.groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={modelFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
            {modelLabel}
          </label>
          <select
            id={modelFieldId}
            value={state.modelId}
            onChange={(event) => state.selectModel(event.target.value)}
            disabled={!state.group}
            className={cn(SELECT_CLASSES)}
          >
            <option value="">{state.group ? "선택하세요" : `먼저 ${groupLabel}를 선택하세요`}</option>
            {state.modelOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {renderModelLabel ? renderModelLabel(item) : item.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-rose-500 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
