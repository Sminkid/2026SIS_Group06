import { isUsydEngineeringDegree } from "../../domain/usydEngineeringStructure";
import { GenericDegreeStructure } from "./GenericDegreeStructure";
import type { DegreeStructureProps } from "./types";
import { UsydEngineeringStructure } from "./usyd/UsydEngineeringStructure";

export const DegreeStructureRenderer = (props: DegreeStructureProps) =>
  isUsydEngineeringDegree(props.detail)
    ? <UsydEngineeringStructure {...props} />
    : <GenericDegreeStructure {...props} />;
