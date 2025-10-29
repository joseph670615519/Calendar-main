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
let liveEvents = [];

$(document).ready(function () {
  renderCalendar(currentMonth, currentYear);
  setupRealtimeListener(currentMonth, currentYear);

  $("#prevMonth").click(() => changeMonth(-1));
  $("#nextMonth").click(() => changeMonth(1));
    $("#hasTime").on("change", function () {
    $("#timeInputs").toggle(this.checked);
  });

  $("#addEventForm").on("submit", async function (e) {
    e.preventDefault();

    const title = $("#title").val().trim();
    const date = $("#date").val().trim();
    const details = $("#details").val().trim() || "(no details)";
    const hasTime = $("#hasTime").is(":checked");
    const startTime = hasTime ? $("#startTime").val() : "";
    const endTime = hasTime ? $("#endTime").val() : "";

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
      await addDoc(collection(db, "appointments"), { title, date, details, startTime, endTime });
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
  if (unsubscribe) unsubscribe(); 

  const q = collection(db, "appointments");
  unsubscribe = onSnapshot(q, (snapshot) => {
    liveEvents = []; // store latest info
    snapshot.forEach((docSnap) => {
      liveEvents.push({ id: docSnap.id, ...docSnap.data() });
          if ($("#eventPopup").is(":visible")) {
      refreshOpenPopup(liveEvents);
    }
    });

    // Refresh main calendar
    if ($("#calendar").is(":visible")) {
      renderCalendar(month, year, liveEvents);
    }

    // Refresh popup if visible
    refreshOpenPopup(liveEvents);

    // Refresh "View All Events"
    if ($("#allEventsSection").is(":visible")) {
      updateAllEventsList(liveEvents);
    }
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

const prevMonthDays = 32 - new Date(year, month - 1, 32).getDate();

// === Previous month grey days (tail) ======
for (let i = firstDay - 1; i >= 0; i--) {
  const day = prevMonthDays - i;
  const cell = $("<div>").addClass("day other-month").text(day);
  calendar.append(cell);
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

const totalCells = firstDay + daysInMonth;
const nextDays = 7 * Math.ceil(totalCells / 7) - totalCells;

// ==== Next month gray days (head) ====
for (let i = 1; i <= nextDays; i++) {
  const cell = $("<div>").addClass("day other-month").text(i);
  calendar.append(cell);
}




// ========== POPUP HANDLER ==========
$(".day").off("click").on("click", function (e) {
  // Ignore grey cells (they alrdy have special behavior)
  if ($(this).hasClass("blank") || $(this).hasClass("other-month")) return;

    const dayNumber = $(this).clone().children().remove().end().text().trim();
    const clickedDate = new Date(year, month, dayNumber);
    const formatted = clickedDate.toLocaleDateString("en-CA");

    const dayEvents = events.filter(
      (ev) => normalizeDate(ev.date) === formatted
    );

    $("#popupDate").text(clickedDate.toDateString());
    const popupList = $("#popupEvents");
    popupList.empty();

    // ---- Case 1--- No events for this day 
    if (dayEvents.length === 0) {
      popupList.append(`
        <li class="add-event-section">
          <div>No events for this day.<br>Would you like to add one?</div>
          <button id="addEventYes">Yes</button>
          <button id="addEventNo">No</button>
        </li>
      `);
      addEventButtons(popupList, formatted);
    }

    // --- Case 2 --- Events exist for this day 
    else {
      dayEvents.forEach((ev) => {
      popupList.append(`
        <li data-id="${ev.id}">
          <strong>${ev.title}</strong><br>
          ${ev.startTime ? `${ev.startTime} - ${ev.endTime}<br>` : ""}
          ${ev.details}<br>
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

      addEventButtons(popupList, formatted, true);

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
  const dateText = $("#popupDate").text();

  // Extract time if available
  const timeMatch = li.html().match(/(\d{2}:\d{2}) - (\d{2}:\d{2})/);
  const oldStart = timeMatch ? timeMatch[1] : "";
  const oldEnd = timeMatch ? timeMatch[2] : "";

  // Extract details (text not part of <strong> or time)
let oldDetails = li
  .clone()
  .children()
  .remove()
  .end()
  .text()
  .trim()
  .replace(/\s+/g, " ");

// remove any embedded time text like “12:00 - 14:00”
oldDetails = oldDetails.replace(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/, "").trim();

if (!oldDetails) oldDetails = "(no details)";

  li.html(`
    <form class="editForm" style="text-align:left;">
      <input type="text" name="title" value="${oldTitle}" required /><br>
      <input type="text" name="date" value="${dateText}" disabled /><br>
      <input type="text" name="details" value="${oldDetails}" placeholder="(no details)" /><br>

      <div style="display:flex; align-items:center; gap:6px; margin-top:6px;">
        <label for="hasTime">Specific Time</label>
        <input type="checkbox" id="hasTime" ${oldStart ? "checked" : ""}>
      </div>

      <div id="timeInputs" style="display:${oldStart ? "block" : "none"}; margin-top:4px;">
        <input type="time" id="startTime" value="${oldStart}" placeholder="Start Time"><br>
        <input type="time" id="endTime" value="${oldEnd}" placeholder="End Time"><br>
      </div>

      <button type="submit">💾 Save</button>
      <button type="button" class="cancelEdit">✖ Cancel</button>
    </form>
  `);

  // Show/hide time fields
  li.find("#hasTime").on("change", function () {
    li.find("#timeInputs").toggle(this.checked);
  });

  // Handle save
li.find(".editForm").on("submit", async function (e) {
  e.preventDefault();
  const newTitle = $(this).find("input[name='title']").val().trim();
  const newDetails =
    $(this).find("input[name='details']").val().trim() || "(no details)";
  const hasTime = li.find("#hasTime").is(":checked");
  let newStart = hasTime ? li.find("#startTime").val() : "";
  let newEnd = hasTime ? li.find("#endTime").val() : "";

  // ✅ If "Specific Time" is unchecked, clear both times completely
  if (!hasTime) {
    newStart = "";
    newEnd = "";
  }

  // ✅ If "Specific Time" is checked but both are blank, clear too
  if (hasTime && !newStart && !newEnd) {
    newStart = "";
    newEnd = "";
  }

  try {
    await updateDoc(doc(db, "appointments", id), {
      title: newTitle,
      details: newDetails,
      startTime: newStart,
      endTime: newEnd,
    });

    $("#eventPopup").fadeOut(200);
  } catch (err) {
    alert("Error updating event: " + err.message);
  }
});



  // Handle cancel
  li.find(".cancelEdit").on("click", function () {
    li.html(`
      <strong>${oldTitle}</strong><br>
      ${oldStart ? `${oldStart} - ${oldEnd}<br>` : ""}
      ${oldDetails}<br>
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

// ==== Gray-day month switching (after global click handler) ====
$("#calendar").off("click", ".other-month").on("click", ".other-month", function (e) {
  e.stopImmediatePropagation();
  const dayText = parseInt($(this).text(), 10);

  // Determine if it's a previous or next month gray day
  const isPrev = $(this).index() < 7 && dayText > 20; // likely from previous month
  const isNext = $(this).index() > 20 && dayText < 10; // likely from next month

  if (isPrev) {
    changeMonth(-1, dayText);
  } else if (isNext) {
    changeMonth(1, dayText);
  }
});




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

// =============================
// Helper for popup add buttons
// ===========================
function addEventButtons(popupList, formatted, isAnother = false) {
  const yesBtn = isAnother ? "#addAnotherYes" : "#addEventYes";
  const noBtn = isAnother ? "#addAnotherNo" : "#addEventNo";

  $(noBtn).off("click").on("click", function () {
    $("#eventPopup").fadeOut(200);
  });

  $(yesBtn).off("click").on("click", function () {
popupList.append(`
  <li>
    <form id="popupAddForm" style="text-align:left;">
      <input type="text" id="newTitle" placeholder="Event title" required /><br>
      <input type="text" id="newDate" value="${formatted}" disabled /><br>
      <input type="text" id="newDetails" placeholder="(no details)" /><br>

<div style="display:flex; align-items:center; gap:4px; margin-top:6px; white-space:nowrap;">
  <span>Specific Time</span>
  <input type="checkbox" id="newHasTime" style="margin:0; transform:translateX(-95px);">
</div>

      <div id="newTimeInputs" style="display:none; margin-top:4px;">
        <input type="time" id="newStartTime" placeholder="Start Time"><br>
        <input type="time" id="newEndTime" placeholder="End Time"><br>
      </div>

      <button type="submit">💾 Save</button>
      <button type="button" id="cancelAdd">✖ Cancel</button>
    </form>
  </li>
`);


// Show/hide time inputs
$("#newHasTime").on("change", function() {
  $("#newTimeInputs").toggle(this.checked);
});

$("#cancelAdd").on("click", function () {
  $("#eventPopup").fadeOut(200);
});

$("#popupAddForm").on("submit", async function (e) {
  e.preventDefault();
  const title = $("#newTitle").val().trim();
  const details = $("#newDetails").val().trim() || "(no details)";
  const hasTime = $("#newHasTime").is(":checked");
  const startTime = hasTime ? $("#newStartTime").val() : "";
  const endTime = hasTime ? $("#newEndTime").val() : "";
  try {
    await addDoc(collection(db, "appointments"), {
      title,
      date: formatted,
      details,
      startTime,
      endTime,
    });
    $("#eventPopup").fadeOut(200);
  } catch (err) {
    alert("Error adding event: " + err.message);
  }
});



    


  });

  
}
function openPopupForDate(dateObj) {
  const iso = dateObj.toLocaleDateString("en-CA");

  $("#popupDate")
    .text(dateObj.toDateString())
    .attr("data-iso", iso);


  $("#popupEvents").fadeTo(100, 0.3, () => {
    refreshOpenPopup(liveEvents); // build popup from latest snapshot
    $("#popupEvents").fadeTo(150, 1);
  });

  $("#eventPopup").fadeIn(200);
}

  



// ===============================================
// Refresh the open popup from in-memory events
// ===============================================
function refreshOpenPopup(events) {


  const iso = $("#popupDate").attr("data-iso");
  if (!iso) return;

  const dayEvents = events.filter(ev => normalizeDate(ev.date) === iso);
  const popupList = $("#popupEvents");
  popupList.empty();

  if (dayEvents.length === 0) {
    popupList.append(`
      <li class="add-event-section">
        <div>No events for this day.<br>Would you like to add one?</div>
        <button id="addEventYes">Yes</button>
        <button id="addEventNo">No</button>
      </li>
    `);
    addEventButtons(popupList, iso);
  } else {
    dayEvents.forEach(ev => {
      popupList.append(`
        <li data-id="${ev.id}">
          <strong>${ev.title}</strong><br>
          ${ev.startTime ? `${ev.startTime} - ${ev.endTime}<br>` : ""}
          ${ev.details}<br>
          <button class="edit-btn">✏ Edit</button>
          <button class="delete-btn">🗑 Delete</button>
        </li>
      `);
    });
  }
}


// ==============================
// Helpers
// ==============================
async function changeMonth(offset, targetDay = null) {
  currentMonth += offset;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }

  // Load events first (so popup will show correct data)
  const snapshot = await getDocs(collection(db, "appointments"));
  const events = [];
  snapshot.forEach(docSnap => events.push({ id: docSnap.id, ...docSnap.data() }));

  // Render the new month with events
  renderCalendar(currentMonth, currentYear, events);

  // Re-attach listener for live updates
  setupRealtimeListener(currentMonth, currentYear);

  // If a gray day was clicked, open its popup after render
  if (targetDay !== null) {
    setTimeout(() => {
      const newDate = new Date(currentYear, currentMonth, targetDay);
      openPopupForDate(newDate);
    }, 200);
  }
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
  const timeDisplay =
    ev.startTime && ev.endTime
      ? `${ev.startTime} - ${ev.endTime}`
      : ev.startTime
      ? `${ev.startTime}`
      : "";

  list.append(`
    <li data-id="${ev.id}">
      <strong>${ev.title}</strong>
      <div>Date: ${normalizeDate(ev.date)}</div>
      ${
        timeDisplay
          ? `<div>Time: ${timeDisplay}</div>`
          : ""
      }
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
  const oldTime = li.find("div").eq(1).text().includes("Time:")
    ? li.find("div").eq(1).text().replace("Time: ", "").trim()
    : "";
  const oldDetails = li.find("div").last().text().replace("Details: ", "").trim();

  const [oldStart, oldEnd] = oldTime.includes("-")
    ? oldTime.split(" - ").map((t) => t.trim())
    : ["", ""];

  li.html(`
    <form class="editForm" style="text-align:left;">
      <input type="text" name="title" value="${oldTitle}" required /><br>
      <input type="date" name="date" value="${oldDate}" required /><br>
      <input type="text" name="details" value="${oldDetails}" placeholder="(no details)" /><br>

      <div style="display:flex; align-items:center; gap:6px; margin-top:6px;">
        <label for="hasTime">Specific Time</label>
        <input type="checkbox" id="hasTime" ${oldStart ? "checked" : ""}>
      </div>

      <div id="timeInputs" style="display:${oldStart ? "block" : "none"}; margin-top:4px;">
        <input type="time" id="startTime" value="${oldStart}" placeholder="Start Time"><br>
        <input type="time" id="endTime" value="${oldEnd}" placeholder="End Time"><br>
      </div>

      <button type="submit">💾 Save</button>
      <button type="button" class="cancelEdit">✖ Cancel</button>
    </form>
  `);

  // Show/hide time fields
  li.find("#hasTime").on("change", function () {
    li.find("#timeInputs").toggle(this.checked);
  });

  // Save handler
li.find(".editForm").on("submit", async function (e) {
  e.preventDefault();

  const newTitle = $(this).find("input[name='title']").val().trim();
  const newDate = $(this).find("input[name='date']").val().trim();
  const newDetails =
    $(this).find("input[name='details']").val().trim() || "(no details)";
  const hasTime = $(this).find("#hasTime").is(":checked");
  let newStart = hasTime ? $(this).find("#startTime").val() : "";
  let newEnd = hasTime ? $(this).find("#endTime").val() : "";

  // If "Specific Time" is checked but both fields are blank, clear times completely
  if (hasTime && !newStart && !newEnd) {
    newStart = "";
    newEnd = "";
  }

  try {
    await updateDoc(doc(db, "appointments", id), {
      title: newTitle,
      date: newDate,
      details: newDetails,
      startTime: newStart,
      endTime: newEnd,
    });

    

    li.html(`
      <strong>${newTitle}</strong>
      <div>Date: ${newDate}</div>
      ${newStart && newEnd ? `<div>Time: ${newStart} - ${newEnd}</div>` : ""}
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
      ${oldStart ? `<div>Time: ${oldStart}${oldEnd ? ` - ${oldEnd}` : ""}</div>` : ""}
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

$("#backToCalendar").on("click", async function () {
  $("#allEventsSection").hide();
  $("#calendar, #event-form, #topButtons, #calendar-controls, .weekdays").show();

  //  Force a fresh sync when returning to calendar
  const snapshot = await getDocs(collection(db, "appointments"));
  liveEvents = [];
  snapshot.forEach((docSnap) => {
    liveEvents.push({ id: docSnap.id, ...docSnap.data() });
  });

  //  Re-render the calendar with latest updates
  renderCalendar(currentMonth, currentYear, liveEvents);

  
  setupRealtimeListener(currentMonth, currentYear);

  
  refreshOpenPopup(liveEvents);
});


// ==============================
// Helper to update "View All Events" dynamically
// ==============================
function updateAllEventsList(events) {
  const list = $("#allEventsList");
  list.empty();

  if (events.length === 0) {
    list.html("<li>No events found.</li>");
    return;
  }

  events.sort((a, b) => new Date(normalizeDate(a.date)) - new Date(normalizeDate(b.date)));

  events.forEach((ev) => {
    list.append(`
      <li data-id="${ev.id}">
        <strong>${ev.title}</strong>
        <div>Date: ${normalizeDate(ev.date)}</div>
        ${ev.startTime && ev.endTime ? `<div>Time: ${ev.startTime} - ${ev.endTime}</div>` : ""}
        <div>Details: ${ev.details}</div>
        <button class="edit-btn">✏ Edit</button>
        <button class="delete-btn">🗑 Delete</button>
      </li>
    `);
  });
}



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
