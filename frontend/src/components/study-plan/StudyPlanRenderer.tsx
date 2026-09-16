import { StudyPlansSection, type StudyPlansSectionProps } from "../StudyPlansSection";
import { UsydEngineeringStudyPlans } from "./UsydEngineeringStudyPlans";

export const StudyPlanRenderer = (props: StudyPlansSectionProps) =>
  props.universityCode === "USYD" && props.degreeCode === "BHENGINE-04"
    ? <UsydEngineeringStudyPlans degreeCode={props.degreeCode} universityCode={props.universityCode}
      handbookYear={props.handbookYear} onOpenSubject={props.onOpenSubject} />
    : <StudyPlansSection {...props} />;
