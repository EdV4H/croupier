import { useMachine } from "@zag-js/react";
import { useId } from "react";
import type { Optional } from "./internal";
import * as tradingCard from "./state-machine";

export type UseTradingCardProps = Optional<tradingCard.Props, "id">;
export type UseTradingCardReturn = tradingCard.MachineApi;

export const useTradingCard = (
  props?: UseTradingCardProps,
): UseTradingCardReturn => {
  const id = useId();
  const service = useMachine(tradingCard.machine, { id, ...props });
  return tradingCard.connect(service);
};
