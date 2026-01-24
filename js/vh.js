(function () {
  function setVH() {
    // 1vh réel basé sur la hauteur visible (Safari iOS safe)
    document.documentElement.style.setProperty("--vh", (window.innerHeight * 0.01) + "px");
  }

  setVH();
  window.addEventListener("resize", setVH);
})();
