// ==============================
// Firebase setup
// ==============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9CLscm9739RkxsSPX1qU9qznAyeTkP-M",
  authDomain: "calender-26db5.firebaseapp.com",
  projectId: "calender-26db5",
  storageBucket: "calender-26db5.firebasestorage.app",
  messagingSenderId: "540578538693",
  appId: "1:540578538693:web:87bedd879f863ab2f2fcac",
  measurementId: "G-2FVV8ZQ1YD",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==============================
// Calendar Logic
// ==============================
let today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let unsubscribe = null; // real-time listener cleanup

$(document).ready(function () {
  renderCalendar(currentMonth, currentYear);
  setupRealtimeListener(currentMonth, currentYear);

  $("#prevMonth").click(() => changeMonth(-1));
  $("#nextMonth").click(() => changeMonth(1));

  $("#addEventForm").on("submit", async function (e) {
    e.preventDefault();

    const title = $("#title").val().trim();
    const date = $("#date").val().trim();
    const details = $("#details").val().trim() || "(no details)";

    $(".error").text("");
    let valid = true;
    if (!title) {
      $("#title").next(".error").text("Required");
      valid = false;
    }
    if (!date) {
      $("#date").next(".error").text("Required");
      valid = false;
    }
    if (!valid) return;

    try {
      $("#formMessage").text("Saving...");
      await addDoc(collection(db, "appointments"), { title, date, details });
      $("#formMessage").text("Event added!");
      $("#addEventForm")[0].reset();
      $("#calendar").fadeOut(200).fadeIn(400);
      // onSnapshot auto-updates the view
    } catch (err) {
      $("#formMessage").text("Error adding event: " + err.message);
    }
  });
});

// ==============================
// Real-time Firestore Listener
// ==============================
function setupRealtimeListener(month, year) {
  if (unsubscribe) unsubscribe(); // detach old listener
  const q = collection(db, "appointments");
  unsubscribe = onSnapshot(q, (snapshot) => {
    const events = [];
    snapshot.forEach((docSnap) => {
      events.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderCalendar(month, year, events);
  });
}

// ==============================
// Functions
// ==============================
function renderCalendar(month, year, events = []) {
  const calendar = $("#calendar");
  calendar.empty();

  const firstDay = new Date(year, month).getDay();
  const daysInMonth = 32 - new Date(year, month, 32).getDate();

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  $("#monthYear").html(`<span id="monthYearClickable">${monthNames[month]} ${year}</span>`);

  // click month-year → open month picker
  $("#monthYearClickable").off("click").on("click", function () {
    showMonthPicker(year);
  });

  for (let i = 0; i < firstDay; i++) {
    calendar.append(`<div class="day blank"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const fullDate = new Date(year, month, day);
    const isoDate = fullDate.toLocaleDateString("en-CA");
    const cell = $("<div>").addClass("day").text(day);

    if (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    ) {
      cell.addClass("today");
    }

    const dayEvents = events.filter((ev) => normalizeDate(ev.date) === isoDate);
    dayEvents.forEach((ev) => {
      const eventDiv = $("<div>").addClass("event").text(ev.title);
      cell.append(eventDiv);
    });

    calendar.append(cell);
  }

  // ========== POPUP HANDLER ==========
  $(".day").off("click").on("click", function () {
    if ($(this).hasClass("blank")) return;

    const dayNumber = $(this).clone().children().remove().end().text().trim();
    const clickedDate = new Date(year, month, dayNumber);
    const formatted = clickedDate.toLocaleDateString("en-CA");

    const dayEvents = events.filter(
      (ev) => normalizeDate(ev.date) === formatted
    );

    $("#popupDate").text(clickedDate.toDateString());
    const popupList = $("#popupEvents");
    popupList.empty();

    // --- Case 1: No events for this day ---
    if (dayEvents.length === 0) {
      popupList.append(`
        <li class="add-event-section">
          <div>No events for this day.<br>Would you like to add one?</div>
          <button id="addEventYes">Yes</button>
          <button id="addEventNo">No</button>
        </li>
      `);
      addInlineAddHandlers(popupList, formatted);
    }

    // --- Case 2: Events exist for this day ---
    else {
      dayEvents.forEach((ev) => {
        popupList.append(`
          <li data-id="${ev.id}">
            <strong>${ev.title}</strong><br>${ev.details}<br>
            <button class="edit-btn">✏ Edit</button>
            <button class="delete-btn">🗑 Delete</button>
          </li>
        `);
      });

      // "Add another event?" section
      popupList.append(`
        <li class="add-event-section">
          <div>Add another event?</div>
          <button id="addAnotherYes">Yes</button>
          <button id="addAnotherNo">No</button>
        </li>
      `);

      addInlineAddHandlers(popupList, formatted, true);

      // Delete event
      $(".delete-btn").off("click").on("click", async function () {
        const id = $(this).closest("li").data("id");
        if (!confirm("Delete this event?")) return;
        try {
          await deleteDoc(doc(db, "appointments", id));
          $("#eventPopup").fadeOut(200);
        } catch (err) {
          alert("Error deleting event: " + err.message);
        }
      });

      // Edit event
      $(".edit-btn").off("click").on("click", function () {
        const li = $(this).closest("li");
        const id = li.data("id");
        const oldTitle = li.find("strong").text();
        const oldDetails = li
          .contents()
          .filter(function () {
            return this.nodeType === 3;
          })
          .text()
          .trim();

        li.html(`
          <form class="editForm">
            <input type="text" name="title" value="${oldTitle}" required /><br>
            <input type="text" name="date" value="${$("#popupDate").text()}" disabled /><br>
            <input type="text" name="details" value="${oldDetails}" placeholder="(no details)" /><br>
            <button type="submit">💾 Save</button>
            <button type="button" class="cancelEdit">✖ Cancel</button>
          </form>
        `);

        li.find(".editForm").on("submit", async function (e) {
          e.preventDefault();
          const newTitle = $(this).find("input[name='title']").val().trim();
          const newDetails =
            $(this).find("input[name='details']").val().trim() || "(no details)";
          try {
            await updateDoc(doc(db, "appointments", id), {
              title: newTitle,
              details: newDetails,
            });
            $("#eventPopup").fadeOut(200);
          } catch (err) {
            alert("Error updating event: " + err.message);
          }
        });

        li.find(".cancelEdit").on("click", function () {
          li.html(`
            <strong>${oldTitle}</strong><br>${oldDetails}<br>
            <button class="edit-btn">✏ Edit</button>
            <button class="delete-btn">🗑 Delete</button>
          `);
        });
      });
    }

    $("#eventPopup").fadeIn(200);
  });

  // Close popup when clicking X or outside
  $(".close-popup, #eventPopup")
    .off("click")
    .on("click", function (e) {
      if (e.target !== this && !$(e.target).hasClass("close-popup")) return;
      $("#eventPopup").fadeOut(200);
    });
}

// ==============================
// Month Picker + Year Picker
// ==============================
function showMonthPicker(year) {
  $("#calendar, .weekdays, #event-form, #calendar-controls").hide();
  $("#pickerScreen").show();

  $("#pickerHeader").text(year);
  const grid = $("#pickerGrid");
  grid.empty();

  const months = [
    "January", "February", "March", "April",
    "May", "June", "July", "August",
    "September", "October", "November", "December"
  ];

  months.forEach((m, index) => {
    const div = $(`<div class="picker-item">${m}</div>`);
    div.on("click", function () {
      currentMonth = index;
      currentYear = year;
      $("#pickerScreen").hide();
      $("#calendar, .weekdays, #event-form, #calendar-controls").show();
      renderCalendar(currentMonth, currentYear);
      setupRealtimeListener(currentMonth, currentYear);
    });
    grid.append(div);
  });

  $("#pickerHeader").off("click").on("click", function () {
    showYearPicker(year);
  });
}

function showYearPicker(selectedYear) {
  $("#pickerHeader").text(`Select Year`);
  const grid = $("#pickerGrid");
  grid.empty();

  const startYear = Math.floor(selectedYear / 16) * 16;
  const years = [];
  for (let i = startYear; i < startYear + 16; i++) {
    years.push(i);
  }

  years.forEach((year) => {
    const div = $(`<div class="picker-item">${year}</div>`);
    div.on("click", function () {
      showMonthPicker(year);
    });
    grid.append(div);
  });
}

// ==============================
// Helper for inline add forms
// ==============================
function addInlineAddHandlers(popupList, formatted, isAnother = false) {
  const yesBtn = isAnother ? "#addAnotherYes" : "#addEventYes";
  const noBtn = isAnother ? "#addAnotherNo" : "#addEventNo";

  $(noBtn).off("click").on("click", function () {
    $("#eventPopup").fadeOut(200);
  });

  $(yesBtn).off("click").on("click", function () {
    popupList.append(`
      <li>
        <form id="inlineAddForm">
          <input type="text" id="newTitle" placeholder="Event title" required /><br>
          <input type="text" id="newDate" value="${formatted}" disabled /><br>
          <input type="text" id="newDetails" placeholder="(no details)" /><br>
          <button type="submit">💾 Save</button>
          <button type="button" id="cancelAdd">✖ Cancel</button>
        </form>
      </li>
    `);

    $("#cancelAdd").on("click", function () {
      $("#eventPopup").fadeOut(200);
    });

    $("#inlineAddForm").on("submit", async function (e) {
      e.preventDefault();
      const title = $("#newTitle").val().trim();
      const details = $("#newDetails").val().trim() || "(no details)";
      try {
        await addDoc(collection(db, "appointments"), {
          title,
          date: formatted,
          details,
        });
        $("#eventPopup").fadeOut(200);
      } catch (err) {
        alert("Error adding event: " + err.message);
      }
    });
  });
}

// ==============================
// Helpers
// ==============================
function changeMonth(offset) {
  currentMonth += offset;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  setupRealtimeListener(currentMonth, currentYear);
}

function normalizeDate(input) {
  if (!input) return "";
  if (input.includes("/")) {
    const [d, m, y] = input.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split("-");
    const local = new Date(Number(y), Number(m) - 1, Number(d));
    return local.toLocaleDateString("en-CA");
  }

  return new Date(input).toLocaleDateString("en-CA");
}

// ==============================
// "View All Events" screen logic
// ==============================
$("#viewAllEvents").on("click", async function () {
  $("#calendar, #event-form, #topButtons, #calendar-controls, .weekdays").hide();
  $("#allEventsSection").show();

  $("#allEventsList").html("<li>Loading events...</li>");

  try {
    const snapshot = await getDocs(collection(db, "appointments"));
    const events = [];
    snapshot.forEach((docSnap) => {
      events.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (events.length === 0) {
      $("#allEventsList").html("<li>No events found.</li>");
      return;
    }

    events.sort(
      (a, b) =>
        new Date(normalizeDate(a.date)) - new Date(normalizeDate(b.date))
    );

    const list = $("#allEventsList");
    list.empty();
    events.forEach((ev) => {
      list.append(`
        <li data-id="${ev.id}">
          <strong>${ev.title}</strong>
          <div>Date: ${normalizeDate(ev.date)}</div>
          <div>Details: ${ev.details}</div>
          <button class="edit-btn">✏ Edit</button>
          <button class="delete-btn">🗑 Delete</button>
        </li>
      `);
    });

    // Delete event
    $(".delete-btn").off("click").on("click", async function () {
      const id = $(this).closest("li").data("id");
      if (!confirm("Are you sure you want to delete this event?")) return;
      try {
        await deleteDoc(doc(db, "appointments", id));
        $(this).closest("li").fadeOut(300, function () {
          $(this).remove();
        });
      } catch (err) {
        alert("Error deleting event: " + err.message);
      }
    });

    // Edit event
    $(".edit-btn").off("click").on("click", function () {
      const li = $(this).closest("li");
      const id = li.data("id");
      const oldTitle = li.find("strong").text();
      const oldDate = li.find("div").eq(0).text().replace("Date: ", "").trim();
      const oldDetails = li
        .find("div")
        .eq(1)
        .text()
        .replace("Details: ", "")
        .trim();

      li.html(`
        <form class="editForm">
          <input type="text" name="title" value="${oldTitle}" required /><br>
          <input type="date" name="date" value="${oldDate}" required /><br>
          <input type="text" name="details" value="${oldDetails}" /><br>
          <button type="submit">💾 Save</button>
          <button type="button" class="cancelEdit">✖ Cancel</button>
        </form>
      `);

      li.find(".editForm").on("submit", async function (e) {
        e.preventDefault();
        const newTitle = $(this).find("input[name='title']").val().trim();
        const newDate = $(this).find("input[name='date']").val().trim();
        const newDetails =
          $(this).find("input[name='details']").val().trim() || "(no details)";

        try {
          await updateDoc(doc(db, "appointments", id), {
            title: newTitle,
            date: newDate,
            details: newDetails,
          });

          li.html(`
            <strong>${newTitle}</strong>
            <div>Date: ${newDate}</div>
            <div>Details: ${newDetails}</div>
            <button class="edit-btn">✏ Edit</button>
            <button class="delete-btn">🗑 Delete</button>
          `);
        } catch (err) {
          alert("Error updating event: " + err.message);
        }
      });

      li.find(".cancelEdit").on("click", function () {
        li.html(`
          <strong>${oldTitle}</strong>
          <div>Date: ${oldDate}</div>
          <div>Details: ${oldDetails}</div>
          <button class="edit-btn">✏ Edit</button>
          <button class="delete-btn">🗑 Delete</button>
        `);
      });
    });
  } catch (err) {
    console.error(err);
    $("#allEventsList").html("<li style='color:red;'>Error loading events.</li>");
  }
});

$("#backToCalendar").on("click", function () {
  $("#allEventsSection").hide();
  $("#calendar, #event-form, #topButtons, #calendar-controls, .weekdays").show();
});

// ==============================
// Jump to Today Button
// ==============================
$("#jumpToToday").on("click", function () {
  const now = new Date();
  currentMonth = now.getMonth();
  currentYear = now.getFullYear();

  // Ensure main calendar is visible (in case user is on view-all or picker)
  $("#pickerScreen, #allEventsSection").hide();
  $("#calendar, #event-form, #topButtons, #calendar-controls, .weekdays").show();

  // Re-render the calendar
  renderCalendar(currentMonth, currentYear);
  setupRealtimeListener(currentMonth, currentYear);

  // Optional: Brief highlight of today's date
  setTimeout(() => {
    $(".today").css({ background: "#00bfff" });
    setTimeout(() => $(".today").css({ background: "#e9f5ff" }), 1000);
  }, 300);
});

// ==============================
// Back to Calendar from month/year picker
// ==============================
$("#backToCalendarFromPicker").on("click", function () {
  $("#pickerScreen").hide(); // hide month/year picker
  $("#calendar, #event-form, #topButtons, #calendar-controls, .weekdays").show();
  renderCalendar(currentMonth, currentYear);
  setupRealtimeListener(currentMonth, currentYear);
});
