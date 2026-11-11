"use client";
import { Minus, Plus } from "lucide-react";
import {
  BULK_STEP_GRAMS,
  BULK_WEIGHTS,
  MAX_BULK_WEIGHT_GRAMS,
} from "@/lib/pricing.mjs";

export function WeightSelector({
  value,
  onChange,
  name,
}: {
  value: number;
  onChange: (weight: number) => void;
  name: string;
}) {
  return (
    <div className="weight-stepper">
      <button
        type="button"
        aria-label={`Diminuir 100 g de ${name}`}
        disabled={value <= BULK_STEP_GRAMS}
        onClick={() => onChange(value - BULK_STEP_GRAMS)}
      >
        <Minus size={18} />
      </button>
      <select
        value={value}
        aria-label={`Peso de ${name}`}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {BULK_WEIGHTS.map((weight) => (
          <option key={weight} value={weight}>
            {weight.toLocaleString("pt-BR")} g
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Aumentar 100 g de ${name}`}
        disabled={value >= MAX_BULK_WEIGHT_GRAMS}
        onClick={() => onChange(value + BULK_STEP_GRAMS)}
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
