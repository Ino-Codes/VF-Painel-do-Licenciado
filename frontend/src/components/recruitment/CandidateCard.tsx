import React, { useRef } from "react";
import { useDrag } from "react-dnd";
import { Task } from "../../types/recruitment";
import type { Identifier, XYCoord } from "dnd-core";

interface CandidateCardProps {
  id: number;
  name: string;
  role_applied_for: string;
  tasks?: Task[];
  onClick: () => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({
  id,
  name,
  role_applied_for,
  tasks = [],
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, dragRef] = useDrag<
    { id: number; type: string },
    void,
    { isDragging: boolean }
  >({
    type: "CANDIDATE",
    item: { id, type: "CANDIDATE" },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  dragRef(ref);

  const completedTasks = tasks.filter((task) => task.is_completed).length;
  const totalTasks = tasks.length;
  const progressPercentage =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div
      ref={ref}
      className={`candidate-card ${isDragging ? "dragging" : ""}`}
      onClick={onClick}
    >
      <div className="candidate-header">
        <div>
          <h3 className="candidate-name">{name}</h3>
          <div className="candidate-role">{role_applied_for}</div>
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="candidate-tasks">
          <div className="task-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span>
              {completedTasks}/{totalTasks}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateCard;
