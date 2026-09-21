import { StudyPlansSection, type StudyPlansSectionProps } from "../StudyPlansSection";
import { UsydEngineeringStudyPlanController } from "./usyd/UsydEngineeringStudyPlanController";

export const StudyPlanRenderer = (props: StudyPlansSectionProps) =>
  props.universityCode === "USYD" && props.degreeCode === "BHENGINE-04"
    ? <UsydEngineeringStudyPlanController degreeCode={props.degreeCode} universityCode={props.universityCode}
      degreeName={props.degreeName} handbookYear={props.handbookYear} onOpenSubject={props.onOpenSubject} requirements={props.requirements}
      selectedComponents={props.selectedComponents} componentDetails={props.componentDetails}
      componentDetailsStatus={props.componentDetailsStatus} />
    : <StudyPlansSection {...props} />;
