import type { ReactElement } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CameraList, Job } from "../../shared/types";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

interface JobListSelectorProps {
  jobs: Job[];
  cameraLists: CameraList[];
  activeCameraListId: string | null;
  activeList: CameraList | null;
  onSelectCameraList: (cameraListId: string) => void;
  onCreateJob: (jobName: string, listName: string, defaultPrefix: string) => void;
  onUpdateJobName: (jobName: string) => void;
  onDeleteJob: (jobId: string) => void;
}

export function JobListSelector({
  jobs,
  cameraLists,
  activeCameraListId,
  activeList,
  onSelectCameraList,
  onCreateJob,
  onUpdateJobName,
  onDeleteJob
}: JobListSelectorProps): ReactElement {
  const [creating, setCreating] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [newJobName, setNewJobName] = useState("New Job");
  const [newListName, setNewListName] = useState("Camera List");
  const [newDefaultPrefix, setNewDefaultPrefix] = useState(
    activeList?.defaultPrefix ?? "http://192.168.1."
  );
  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeList?.jobId) ?? null,
    [activeList?.jobId, jobs]
  );
  const [jobNameDraft, setJobNameDraft] = useState(activeJob?.name ?? "");

  useEffect(() => {
    setJobNameDraft(activeJob?.name ?? "");
  }, [activeJob?.id, activeJob?.name]);

  useEffect(() => {
    if (!creating) {
      return;
    }

    setNewDefaultPrefix(activeList?.defaultPrefix ?? "http://192.168.1.");
  }, [activeList?.defaultPrefix, creating]);

  function createJob(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const jobName = newJobName.trim();
    const listName = newListName.trim();
    const defaultPrefix = newDefaultPrefix.trim();
    if (!jobName || !listName || !defaultPrefix) {
      return;
    }

    onCreateJob(jobName, listName, defaultPrefix);
    setCreating(false);
    setNewJobName("New Job");
    setNewListName("Camera List");
  }

  function renameJob(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const jobName = jobNameDraft.trim();
    if (!jobName || jobName === activeJob?.name) {
      return;
    }

    onUpdateJobName(jobName);
  }

  function deleteJob(): void {
    if (!activeJob) {
      return;
    }

    onDeleteJob(activeJob.id);
    setConfirmDeleteOpen(false);
  }

  return (
    <div className="job-list-stack">
      <div className="job-list-selector">
        <select
          aria-label="Job and camera list"
          value={activeCameraListId ?? ""}
          onChange={(event) => onSelectCameraList(event.target.value)}
        >
          {cameraLists.map((list) => {
            const job = jobs.find((candidate) => candidate.id === list.jobId);
            return (
              <option key={list.id} value={list.id}>
                {job?.name ?? "Job"} / {list.name}
              </option>
            );
          })}
        </select>
        <Button
          icon={<Plus size={14} strokeWidth={2.2} />}
          variant="subtle"
          size="compact"
          tooltip={{
            title: "New job",
            description: "Creates a job with its first camera list and address prefix."
          }}
          onClick={() => setCreating((open) => !open)}
        >
          New Job
        </Button>
        <Button
          icon={<Trash2 size={14} strokeWidth={2.2} />}
          variant="danger"
          size="compact"
          disabled={!activeJob}
          tooltip={{
            title: "Delete job",
            description: "Removes this job, its camera lists, and its saved camera passwords."
          }}
          onClick={() => setConfirmDeleteOpen(true)}
        >
          Delete Job
        </Button>
      </div>
      {activeJob && (
        <form className="job-inline-form" onSubmit={renameJob}>
          <label className="job-inline-field">
            <span>Current Job</span>
            <input
              aria-label="Current job name"
              value={jobNameDraft}
              onChange={(event) => setJobNameDraft(event.target.value)}
            />
          </label>
          <Button type="submit" variant="subtle" size="compact">
            Save Job Name
          </Button>
        </form>
      )}
      {creating && (
        <form className="new-job-form" aria-label="New job form" onSubmit={createJob}>
          <label className="job-inline-field">
            <span>Job</span>
            <input
              aria-label="New job name"
              value={newJobName}
              onChange={(event) => setNewJobName(event.target.value)}
            />
          </label>
          <label className="job-inline-field">
            <span>List</span>
            <input
              aria-label="New camera list name"
              value={newListName}
              onChange={(event) => setNewListName(event.target.value)}
            />
          </label>
          <label className="job-inline-field new-job-prefix-field">
            <span>Prefix</span>
            <input
              aria-label="New default URL prefix"
              value={newDefaultPrefix}
              onChange={(event) => setNewDefaultPrefix(event.target.value)}
            />
          </label>
          <div className="new-job-actions">
            <Button type="submit" variant="primary" size="compact">
              Create Job
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {confirmDeleteOpen && activeJob && (
        <Dialog
          title="Delete job"
          description={`Delete "${activeJob.name}" and all of its camera lists and saved camera passwords? This cannot be undone.`}
          onClose={() => setConfirmDeleteOpen(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={deleteJob}>
                Delete job
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
