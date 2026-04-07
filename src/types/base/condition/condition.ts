export enum ConditionOperation {
  equality = "equality",
  in_range = "in_range",
  has_tag = "has_tag",
}

export interface ConditionBase {
  metric: string;
}

export interface ConditionOperationInRangeValue {
  min?: number;
  max?: number;
}

export interface AgeOperationInRangeValue {
  min: number;
  max: number;
  value_type: string;
}

export type Condition =
  | (ConditionBase & {
      operation: ConditionOperation.equality;
      value: string;
    })
  | (ConditionBase & {
      operation: ConditionOperation.in_range;
      value: ConditionOperationInRangeValue;
    })
  | (ConditionBase & {
      metric: "patient_age";
      operation: ConditionOperation.equality;
      value: { value: number; value_type: string };
    })
  | (ConditionBase & {
      metric: "patient_age";
      operation: ConditionOperation.in_range;
      value: AgeOperationInRangeValue;
    });
