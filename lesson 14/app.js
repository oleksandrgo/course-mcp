(function () {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const deck = document.getElementById("deck");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const dotsContainer = document.getElementById("dots");
  const navProgress = document.getElementById("navProgress");

  let current = 0;
  let isAnimating = false;
  /** Скільки пунктів плану вже показано на слайді 2 (0…N) */
  let planRevealCount = 0;
  /** Для кожного слайду: скільки пунктів списку вже показано */
  const listRevealCounts = new Map();
  /** Для кожного слайду: скільки карточок з послідовністю вже показано */
  const tokenRevealCounts = new Map();
  /** Для кожного слайду: скільки кроків діаграми вже показано */
  const diagramRevealCounts = new Map();

  function isDiagramSlide(index) {
    return slides[index]?.classList?.contains("diagram-slide") ?? false;
  }

  function getDiagramSteps(index) {
    const slide = slides[index];
    if (!slide) return [];
    const agentFlow = slide.querySelector(".evo-flow--agent");
    if (agentFlow) {
      return Array.from(agentFlow.querySelectorAll("[data-reveal-step]")).sort(
        (a, b) => Number(a.dataset.revealStep) - Number(b.dataset.revealStep)
      );
    }
    return slide.querySelectorAll(".mcp-flow__step, .evo-flow__step");
  }

  function getDiagramRoot(index) {
    const slide = slides[index];
    if (!slide) return null;
    return slide.querySelector(".mcp-flow, .evo-flow");
  }

  function isAgentSlide(index) {
    return !!slides[index]?.querySelector(".evo-flow--agent");
  }

  function layoutAgentBridge(index) {
    if (!isAgentSlide(index) || window.innerWidth <= 720) return;

    const slide = slides[index];
    const board = slide.querySelector(".evo-agent-board");
    const card = slide.querySelector(".evo-agent-llm__card");
    const frame = slide.querySelector(".evo-agent-zone__frame");
    const bridge = slide.querySelector(".evo-agent-bridge");
    if (!board || !card || !frame || !bridge) return;

    const boardRect = board.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

    const y = cardRect.top + cardRect.height / 2 - boardRect.top;
    const x1 = cardRect.right - boardRect.left;
    const x2 = frameRect.left - boardRect.left;
    const width = Math.max(0, x2 - x1);

    bridge.style.top = `${y}px`;
    bridge.style.left = `${x1}px`;
    bridge.style.width = `${width}px`;

    bridge.querySelectorAll(".evo-agent-bridge-step").forEach((step) => {
      const line = getAgentArrowPath(step);
      if (!line || typeof line.getTotalLength !== "function") return;
      const length = line.getTotalLength();
      const opacity = gsap.getProperty(step, "opacity");
      if (!opacity) {
        gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
      }
    });
  }

  function getAgentArrowPath(el) {
    if (!el.classList.contains("evo-agent-arrow") && !el.classList.contains("evo-agent-bridge-step")) {
      return null;
    }
    if (el.tagName === "line" || el.tagName === "path") return el;
    return el.querySelector("line") || el.querySelector("path");
  }

  function getAgentZoneParts(el) {
    if (!el.classList.contains("evo-agent-zone")) return null;
    return el.querySelectorAll(".evo-agent-zone__frame, .evo-agent-query");
  }

  function resetDiagramSteps(index) {
    const steps = getDiagramSteps(index);
    if (!steps.length) return;
    steps.forEach((el) => {
      const zoneParts = getAgentZoneParts(el);
      const arrowPath = getAgentArrowPath(el);
      if (zoneParts?.length) {
        gsap.set(zoneParts, { opacity: 0, y: 16, scale: 0.96 });
      } else if (arrowPath && typeof arrowPath.getTotalLength === "function") {
        const length = arrowPath.getTotalLength();
        gsap.set(el, { opacity: 0, visibility: "hidden" });
        gsap.set(arrowPath, { strokeDasharray: length, strokeDashoffset: length });
      } else {
        gsap.set(el, { opacity: 0, y: 16, scale: 0.96 });
      }
    });
    diagramRevealCounts.set(index, 0);
    getDiagramRoot(index)?.classList.remove("mcp-flow--streaming", "evo-flow--streaming");
    requestAnimationFrame(() => layoutAgentBridge(index));
  }

  function revealDiagramStep(el, onComplete) {
    const zoneParts = getAgentZoneParts(el);
    if (zoneParts?.length) {
      gsap.fromTo(
        zoneParts,
        { opacity: 0, y: 20, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.48,
          ease: "power3.out",
          clearProps: "transform",
          onComplete: () => {
            layoutAgentBridge(current);
            onComplete?.();
          },
        }
      );
      return;
    }

    const arrowPath = getAgentArrowPath(el);
    if (arrowPath && typeof arrowPath.getTotalLength === "function") {
      layoutAgentBridge(current);
      const length = arrowPath.getTotalLength();
      gsap.set(el, { visibility: "visible" });
      gsap.fromTo(
        el,
        { opacity: 0 },
        { opacity: 1, duration: 0.12, ease: "none" }
      );
      gsap.fromTo(
        arrowPath,
        { strokeDasharray: length, strokeDashoffset: length },
        {
          strokeDashoffset: 0,
          duration: 0.55,
          ease: "power2.out",
          onComplete,
        }
      );
      return;
    }

    gsap.fromTo(
      el,
      { opacity: 0, y: 20, scale: 0.96 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.48,
        ease: "power3.out",
        clearProps: "transform",
        onComplete,
      }
    );
  }

  function hideDiagramStep(el, onComplete) {
    const zoneParts = getAgentZoneParts(el);
    if (zoneParts?.length) {
      gsap.to(zoneParts, {
        opacity: 0,
        y: -12,
        scale: 0.96,
        duration: 0.24,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(zoneParts, { y: 16 });
          onComplete?.();
        },
      });
      return;
    }

    const arrowPath = getAgentArrowPath(el);
    if (arrowPath && typeof arrowPath.getTotalLength === "function") {
      const length = arrowPath.getTotalLength();
      gsap.to(arrowPath, {
        strokeDashoffset: length,
        duration: 0.28,
        ease: "power2.in",
      });
      gsap.to(el, {
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(el, { visibility: "hidden" });
          onComplete?.();
        },
      });
      return;
    }

    gsap.to(el, {
      opacity: 0,
      y: -12,
      scale: 0.96,
      duration: 0.24,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(el, { y: 16 });
        onComplete?.();
      },
    });
  }

  function revealNextDiagramStep() {
    if (!isDiagramSlide(current)) return false;
    const steps = getDiagramSteps(current);
    if (!steps.length) return false;
    const shown = diagramRevealCounts.get(current) || 0;
    if (shown >= steps.length) return false;

    const el = steps[shown];
    diagramRevealCounts.set(current, shown + 1);
    revealDiagramStep(el, () => {
      if (shown + 1 >= steps.length) {
        getDiagramRoot(current)?.classList.add("mcp-flow--streaming", "evo-flow--streaming");
      }
    });
    return true;
  }

  function hideLastDiagramStep() {
    if (!isDiagramSlide(current)) return false;
    const steps = getDiagramSteps(current);
    if (!steps.length) return false;
    const shown = diagramRevealCounts.get(current) || 0;
    if (shown <= 0) return false;

    const nextShown = shown - 1;
    const el = steps[nextShown];
    diagramRevealCounts.set(current, nextShown);
    getDiagramRoot(current)?.classList.remove("mcp-flow--streaming", "evo-flow--streaming");
    hideDiagramStep(el);
    return true;
  }

  function isStepsSlide(index) {
    return slides[index]?.classList?.contains("steps-slide") ?? false;
  }

  function getTokenCards(index) {
    const slide = slides[index];
    if (!slide) return [];
    return slide.querySelectorAll(".steps-slide .token-card");
  }

  function resetTokenCards(index) {
    const cards = getTokenCards(index);
    if (!cards.length) return;
    gsap.set(cards, { opacity: 0, y: 16 });
    tokenRevealCounts.set(index, 0);
  }

  function revealNextTokenCard() {
    if (!isStepsSlide(current)) return false;
    const cards = getTokenCards(current);
    if (!cards.length) return false;
    const shown = tokenRevealCounts.get(current) || 0;
    if (shown >= cards.length) return false;

    const el = cards[shown];
    tokenRevealCounts.set(current, shown + 1);
    gsap.fromTo(
      el,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.48,
        ease: "power3.out",
        clearProps: "transform",
      }
    );
    return true;
  }

  function hideLastTokenCard() {
    if (!isStepsSlide(current)) return false;
    const cards = getTokenCards(current);
    if (!cards.length) return false;
    const shown = tokenRevealCounts.get(current) || 0;
    if (shown <= 0) return false;

    const nextShown = shown - 1;
    const el = cards[nextShown];
    tokenRevealCounts.set(current, nextShown);
    gsap.to(el, {
      opacity: 0,
      y: -12,
      duration: 0.24,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(el, { y: 16 });
      },
    });
    return true;
  }

  function buildDots() {
    dotsContainer.innerHTML = "";
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "nav__dot" + (i === 0 ? " nav__dot--active" : "");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.setAttribute("aria-label", "Слайд " + (i + 1));
      b.addEventListener("click", () => goTo(i));
      dotsContainer.appendChild(b);
    });
  }

  function updateDots() {
    dotsContainer.querySelectorAll(".nav__dot").forEach((dot, i) => {
      dot.classList.toggle("nav__dot--active", i === current);
      dot.setAttribute("aria-selected", i === current ? "true" : "false");
    });
    if (navProgress) {
      navProgress.textContent = `${current + 1} / ${slides.length}`;
    }
  }

  function playVideosForSlide(index) {
    slides.forEach((slide, i) => {
      const v = slide.querySelector(".slide__video");
      if (!v) return;
      if (i === index) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }

  function getPlanSteps() {
    return slides[1] ? slides[1].querySelectorAll(".js-plan-step") : [];
  }

  function getListItems(index) {
    return slides[index] ? slides[index].querySelectorAll(".content-list__item") : [];
  }

  function resetListItems(index) {
    const items = getListItems(index);
    if (!items.length) return;
    gsap.set(items, { opacity: 0, y: 16 });
    listRevealCounts.set(index, 0);
  }

  function revealNextPlanStep() {
    const steps = getPlanSteps();
    if (current !== 1 || planRevealCount >= steps.length) return false;
    const el = steps[planRevealCount];
    planRevealCount += 1;
    gsap.fromTo(
      el,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.48,
        ease: "power3.out",
        clearProps: "transform",
      }
    );
    return true;
  }

  function hideLastPlanStep() {
    const steps = getPlanSteps();
    if (current !== 1 || planRevealCount <= 0) return false;
    planRevealCount -= 1;
    const el = steps[planRevealCount];
    gsap.to(el, {
      opacity: 0,
      y: -12,
      duration: 0.28,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(el, { y: 16 });
      },
    });
    return true;
  }

  function revealNextListItem() {
    const items = getListItems(current);
    if (!items.length) return false;
    const shown = listRevealCounts.get(current) || 0;
    if (shown >= items.length) return false;

    const el = items[shown];
    listRevealCounts.set(current, shown + 1);
    gsap.fromTo(
      el,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.42,
        ease: "power3.out",
        clearProps: "transform",
      }
    );
    return true;
  }

  function hideLastListItem() {
    const items = getListItems(current);
    if (!items.length) return false;
    const shown = listRevealCounts.get(current) || 0;
    if (shown <= 0) return false;

    const nextShown = shown - 1;
    const el = items[nextShown];
    listRevealCounts.set(current, nextShown);
    gsap.to(el, {
      opacity: 0,
      y: -12,
      duration: 0.24,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(el, { y: 16 });
      },
    });
    return true;
  }

  function animateSlideIn(index, onDone) {
    const slide = slides[index];
    const isPlan = index === 1;
    if (isPlan) {
      const headers = slide.querySelectorAll(".js-reveal-plan-header");
      const steps = slide.querySelectorAll(".js-plan-step");
      gsap.set(steps, { opacity: 0, y: 16 });
      planRevealCount = 0;
      gsap.fromTo(
        headers,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          stagger: 0.1,
          ease: "power3.out",
          clearProps: "transform",
          onComplete: onDone,
        }
      );
      return;
    }
    const isSteps = slide.classList.contains("steps-slide");
    const isDiagram = slide.classList.contains("diagram-slide");
    const targets = slide.querySelectorAll(
      isSteps
        ? ".js-reveal:not(.content-list__item):not(.token-card)"
        : isDiagram
          ? ".js-reveal:not(.content-list__item):not(.mcp-flow__step):not(.evo-flow__step)"
          : ".js-reveal:not(.content-list__item)"
    );
    gsap.fromTo(
      targets,
      { opacity: 0, y: 28 },
      {
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger: 0.12,
        ease: "power3.out",
        clearProps: "transform",
        onComplete: onDone,
      }
    );
  }

  function goTo(nextIndex) {
    if (isAnimating || nextIndex === current) return;
    if (nextIndex < 0 || nextIndex >= slides.length) return;

    isAnimating = true;
    const prev = current;
    current = nextIndex;

    const outgoing = slides[prev];
    const incoming = slides[current];

    const outTargets =
      prev === 1
        ? outgoing.querySelectorAll(".js-reveal-plan-header, .js-plan-step")
        : outgoing.querySelectorAll(".js-reveal");

    gsap.to(outTargets, {
      opacity: 0,
      y: -16,
      duration: 0.35,
      stagger: 0.03,
      ease: "power2.in",
      onComplete: () => {
        if (prev === 1) planRevealCount = 0;
        outgoing.classList.remove("slide--active");
        incoming.classList.add("slide--active");
        updateDots();
        playVideosForSlide(current);

        if (current === 1) {
          gsap.set(incoming.querySelectorAll(".js-reveal-plan-header"), {
            opacity: 0,
            y: 24,
          });
          gsap.set(incoming.querySelectorAll(".js-plan-step"), { opacity: 0, y: 16 });
          planRevealCount = 0;
        } else {
          const isStepsIncoming = incoming.classList.contains("steps-slide");
          const isDiagramIncoming = incoming.classList.contains("diagram-slide");
          const revealSelector = isStepsIncoming
            ? ".js-reveal:not(.content-list__item):not(.token-card)"
            : isDiagramIncoming
              ? ".js-reveal:not(.content-list__item):not(.mcp-flow__step):not(.evo-flow__step)"
              : ".js-reveal:not(.content-list__item)";

          gsap.set(incoming.querySelectorAll(revealSelector), { opacity: 0, y: 24 });

          if (incoming.classList.contains("steps-slide")) {
            resetTokenCards(current);
          } else if (incoming.classList.contains("diagram-slide")) {
            resetDiagramSteps(current);
          } else {
            resetListItems(current);
          }
        }

        animateSlideIn(current, () => {
          layoutAgentBridge(current);
          isAnimating = false;
        });
      },
    });
  }

  function next() {
    if (isAnimating) return;
    if (current === 1 && revealNextPlanStep()) return;
    if (current !== 1) {
      if (revealNextDiagramStep()) return;
      if (revealNextTokenCard()) return;
      if (revealNextListItem()) return;
    }
    goTo(Math.min(current + 1, slides.length - 1));
  }

  function prev() {
    if (isAnimating) return;
    if (current === 1 && hideLastPlanStep()) return;
    if (current !== 1) {
      if (hideLastDiagramStep()) return;
      if (hideLastTokenCard()) return;
      if (hideLastListItem()) return;
    }
    goTo(Math.max(current - 1, 0));
  }

  prevBtn.addEventListener("click", () => prev());
  nextBtn.addEventListener("click", () => next());

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(slides.length - 1);
    }
  });

  deck.addEventListener(
    "click",
    (e) => {
      if (e.target.closest(".nav") || e.target.closest("a") || e.target.closest("button"))
        return;
      if (current < slides.length - 1) next();
    },
    { capture: true }
  );

  window.addEventListener("resize", () => layoutAgentBridge(current));

  buildDots();
  playVideosForSlide(0);

  /* Не ставити opacity на <section.slide> через GSAP — інлайн-стиль перебиває
     .slide--active і другий слайд стає повністю невидимим. */
  slides[0].classList.add("slide--active");

  document.querySelectorAll(".slide__video").forEach((video) => {
    video.addEventListener("error", () => {
      video.classList.add("slide__video--failed");
      video.closest(".slide")?.classList.add("slide--video-fallback");
    });
    video.addEventListener("loadeddata", () => {
      video.classList.remove("slide__video--failed");
      video.closest(".slide")?.classList.remove("slide--video-fallback");
    });
  });

  gsap.fromTo(
    slides[0].querySelectorAll(".js-reveal"),
    { opacity: 0, y: 32 },
    {
      opacity: 1,
      y: 0,
      duration: 0.85,
      stagger: 0.14,
      ease: "power3.out",
      delay: 0.15,
      clearProps: "transform",
    }
  );
})();
