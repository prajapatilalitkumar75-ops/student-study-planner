
const taskList = document.getElementById("taskList");
const taskForm = document.getElementById("taskForm");
const formTitle = document.getElementById("formTitle");
const saveButton = document.getElementById("saveButton");
const cancelEdit = document.getElementById("cancelEdit");
const formMessage = document.getElementById("formMessage");
const filterSelect = document.getElementById("filterSelect");
const searchInput = document.getElementById("searchInput");
const subjectFilter = document.getElementById("subjectFilter");
const priorityFilter = document.getElementById("priorityFilter");

let tasks = [];
let editingId = null;

const today = new Date();
document.getElementById("todayLabel").textContent =
  today.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showMessage(message, success = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("success", success);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.error || payload.message || "Something went wrong."
    );
  }

  return payload;
}

async function loadTasks() {
  taskList.innerHTML =
    '<div class="loading-state">Loading your tasks…</div>';

  try {
    tasks = await api("/api/tasks");
    render();
  } catch (error) {
    taskList.innerHTML = `
      <div class="empty-state">
        Could not load tasks.<br>
        ${escapeHtml(error.message)}<br><br>
        Check that Flask and MySQL are running.
      </div>`;
  }
}

function render() {
  // Statistics always show all tasks, not just filtered tasks.
  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.length - completed;

  document.getElementById("totalCount").textContent = tasks.length;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("completedCount").textContent = completed;

  const percent = tasks.length
    ? Math.round(completed / tasks.length * 100)
    : 0;

  document.getElementById("progressText").textContent = `${percent}%`;
  document.getElementById("progressBar").style.width = `${percent}%`;

  // Fill subject dropdown using subjects already present in tasks.
  const previousSubject = subjectFilter.value;

  const subjects = [
    ...new Set(
      tasks
        .map(task => (task.subject || "").trim())
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  subjectFilter.innerHTML =
    '<option value="all">All subjects</option>' +
    subjects.map(subject =>
      `<option value="${escapeHtml(subject)}">${escapeHtml(subject)}</option>`
    ).join("");

  subjectFilter.value = subjects.includes(previousSubject)
    ? previousSubject
    : "all";

  // Read all four filter settings.
  const query = searchInput.value.trim().toLowerCase();
  const status = filterSelect.value;
  const selectedSubject = subjectFilter.value;
  const selectedPriority = priorityFilter.value;

  // Apply search, subject, priority and status filters together.
  const visible = tasks.filter(task => {
    const matchesSearch =
      !query ||
      `${task.title} ${task.subject || ""}`
        .toLowerCase()
        .includes(query);

    const matchesStatus =
      status === "all" ||
      (status === "pending" && !task.completed) ||
      (status === "completed" && task.completed);

    const matchesSubject =
      selectedSubject === "all" ||
      (task.subject || "").trim() === selectedSubject;

    const matchesPriority =
      selectedPriority === "all" ||
      task.priority === selectedPriority;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesSubject &&
      matchesPriority
    );
  });

  if (!visible.length) {
    const hasTasks = tasks.length > 0;
    const hasFilters =
      query ||
      status !== "all" ||
      selectedSubject !== "all" ||
      selectedPriority !== "all";

    let message;

    if (!hasTasks) {
      message = "Your list is a fresh start.";
    } else if (hasFilters) {
      message = "No tasks match your search or filters.";
    } else {
      message = "No tasks to show.";
    }

    taskList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✧</div>
        <strong>${message}</strong><br>
        ${hasTasks
          ? "Try changing your search or filters."
          : "Add a task using the form to get started."}
      </div>`;

    return;
  }

  taskList.innerHTML = visible.map(task => {
    const priorityClass =
      `priority-${String(task.priority).toLowerCase()}`;

    const dueLabel = task.due_date
      ? `Due ${new Date(`${task.due_date}T00:00:00`)
          .toLocaleDateString(undefined, {
            month: "short",
            day: "numeric"
          })}`
      : "No due date";

    return `
      <article class="task-item ${task.completed ? "is-complete" : ""}">
        <input
          class="task-check"
          type="checkbox"
          aria-label="Mark ${escapeHtml(task.title)} complete"
          data-action="toggle"
          data-id="${task.id}"
          ${task.completed ? "checked" : ""}
        >

        <div class="task-body">
          <div class="task-title">${escapeHtml(task.title)}</div>

          <div class="task-meta">
            ${task.subject
              ? `<span class="meta-chip">${escapeHtml(task.subject)}</span>`
              : ""}
            <span class="meta-chip ${priorityClass}">
              ${escapeHtml(task.priority)} priority
            </span>
            <span class="meta-chip">${escapeHtml(dueLabel)}</span>
          </div>
        </div>

        <div class="task-actions">
          <button
            class="icon-btn"
            type="button"
            data-action="edit"
            data-id="${task.id}"
            aria-label="Edit task"
          >Edit</button>

          <button
            class="icon-btn delete"
            type="button"
            data-action="delete"
            data-id="${task.id}"
            aria-label="Delete task"
          >Delete</button>
        </div>
      </article>`;
  }).join("");
}

function resetForm() {
  editingId = null;
  taskForm.reset();

  document.getElementById("priority").value = "Medium";
  formTitle.textContent = "Add a task";
  saveButton.textContent = "＋ Add task";
  cancelEdit.classList.add("hidden");
  showMessage("");
}

taskForm.addEventListener("submit", async event => {
  event.preventDefault();

  const data = {
    title: document.getElementById("title").value.trim(),
    subject: document.getElementById("subject").value.trim(),
    priority: document.getElementById("priority").value,
    due_date: document.getElementById("dueDate").value || null,
    completed: editingId
      ? Boolean(tasks.find(task => task.id === editingId)?.completed)
      : false
  };

  if (!data.title) {
    showMessage("Please enter a task name.");
    return;
  }

  const currentEditingId = editingId;
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";

  try {
    if (currentEditingId) {
      await api(`/api/tasks/${currentEditingId}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
    } else {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(data)
      });
    }

    resetForm();
    await loadTasks();
    showMessage(
      currentEditingId
        ? "Task updated successfully."
        : "Task added successfully.",
      true
    );
  } catch (error) {
    showMessage(error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId
      ? "Save changes"
      : "＋ Add task";
  }
});

cancelEdit.addEventListener("click", resetForm);

// Update the list whenever any filter changes.
filterSelect.addEventListener("change", render);
searchInput.addEventListener("input", render);
subjectFilter.addEventListener("change", render);
priorityFilter.addEventListener("change", render);

taskList.addEventListener("change", async event => {
  const control = event.target.closest('[data-action="toggle"]');
  if (!control) return;

  const task = tasks.find(
    item => item.id === Number(control.dataset.id)
  );

  if (!task) return;

  try {
    await api(`/api/tasks/${task.id}`, {
      method: "PUT",
      body: JSON.stringify({
        ...task,
        completed: control.checked
      })
    });

    await loadTasks();
  } catch (error) {
    alert(error.message);
    await loadTasks();
  }
});

taskList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const task = tasks.find(item => item.id === id);
  if (!task) return;

  if (button.dataset.action === "edit") {
    editingId = task.id;

    document.getElementById("title").value = task.title;
    document.getElementById("subject").value = task.subject || "";
    document.getElementById("priority").value = task.priority;
    document.getElementById("dueDate").value = task.due_date || "";

    formTitle.textContent = "Edit task";
    saveButton.textContent = "Save changes";
    cancelEdit.classList.remove("hidden");
    showMessage("");

    document.getElementById("title").focus();
    document.querySelector(".form-panel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });

      if (editingId === id) {
        resetForm();
      }

      await loadTasks();
    } catch (error) {
      alert(error.message);
    }
  }
});

loadTasks();

const sessionForm = document.getElementById("sessionForm");
const sessionList = document.getElementById("sessionList");
const sessionMessage = document.getElementById("sessionMessage");
const sessionSaveButton = document.getElementById("sessionSaveButton");

function showSessionMessage(message, success = false) {
  sessionMessage.textContent = message;
  sessionMessage.classList.toggle("success", success);
}

function escapeSessionHtml(value) {
  return escapeHtml(value);
}

async function loadSessions() {
  sessionList.innerHTML =
    '<div class="loading-state">Loading timetable…</div>';

  try {
    const sessions = await api("/api/study-sessions");

    if (!sessions.length) {
      sessionList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">▦</div>
          <strong>No study sessions yet.</strong><br>
          Add your first session using the form above.
        </div>`;
      return;
    }

    sessionList.innerHTML = sessions.map(session => `
      <article class="session-card">
        <div class="session-details">
          <div class="session-day">
            ${escapeSessionHtml(session.day_of_week)}
          </div>
          <div class="session-title">
            ${escapeSessionHtml(session.subject)}
          </div>
          ${session.topic ? `
            <div class="session-topic">
              Topic: ${escapeSessionHtml(session.topic)}
            </div>` : ""}
          <div class="session-time">
            ${escapeSessionHtml(session.start_time)}
            – ${escapeSessionHtml(session.end_time)}
          </div>
          ${session.notes ? `
            <div class="session-notes">
              ${escapeSessionHtml(session.notes)}
            </div>` : ""}
        </div>
        <button
          class="session-delete"
          type="button"
          data-session-delete="${session.id}"
        >Delete</button>
      </article>
    `).join("");
  } catch (error) {
    sessionList.innerHTML = `
      <div class="empty-state">
        Could not load timetable.<br>
        ${escapeSessionHtml(error.message)}
      </div>`;
  }
}

sessionForm.addEventListener("submit", async event => {
  event.preventDefault();

  const startTime = document.getElementById("sessionStart").value;
  const endTime = document.getElementById("sessionEnd").value;

  if (startTime >= endTime) {
    showSessionMessage("End time must be later than start time.");
    return;
  }

  const data = {
    day_of_week: document.getElementById("sessionDay").value,
    subject: document.getElementById("sessionSubject").value.trim(),
    topic: document.getElementById("sessionTopic").value.trim(),
    start_time: startTime,
    end_time: endTime,
    notes: document.getElementById("sessionNotes").value.trim()
  };

  sessionSaveButton.disabled = true;
  sessionSaveButton.textContent = "Saving…";

  try {
    await api("/api/study-sessions", {
      method: "POST",
      body: JSON.stringify(data)
    });

    sessionForm.reset();
    showSessionMessage("Study session added successfully.", true);
    await loadSessions();
  } catch (error) {
    showSessionMessage(error.message);
  } finally {
    sessionSaveButton.disabled = false;
    sessionSaveButton.textContent = "+ Add study session";
  }
});

sessionList.addEventListener("click", async event => {
  const button = event.target.closest("[data-session-delete]");
  if (!button) return;

  const sessionId = button.dataset.sessionDelete;

  if (!confirm("Delete this study session?")) return;

  button.disabled = true;

  try {
    await api(`/api/study-sessions/${sessionId}`, {
      method: "DELETE"
    });

    showSessionMessage("Study session deleted.", true);
    await loadSessions();
  } catch (error) {
    showSessionMessage(error.message);
    button.disabled = false;
  }
});

loadSessions();
