import { StudyPlansSection, type StudyPlansSectionProps } from "../StudyPlansSection";
import { UsydEngineeringStudyPlanController } from "./usyd/UsydEngineeringStudyPlanController";

export const StudyPlanRenderer = (props: StudyPlansSectionProps) =>
  props.universityCode === "USYD" && props.degreeCode === "BHENGINE-04"
    ? <UsydEngineeringStudyPlanController degreeCode={props.degreeCode} universityCode={props.universityCode}
      handbookYear={props.handbookYear} onOpenSubject={props.onOpenSubject} />
    : <StudyPlansSection {...props} />;
