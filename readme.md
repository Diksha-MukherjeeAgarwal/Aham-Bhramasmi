# 🌍 Earth Jukebox: Change Mode

**Hear how the Earth changes, one note at a time.**

Earth Jukebox: Change Mode is an interactive data sonification project that transforms changes in NASA's Earth at Night satellite imagery into music.

Instead of relying entirely on visual representations, Earth Jukebox allows users to *hear and explore* how our planet has changed over time. It is designed with blind and low-vision users in mind, while offering an engaging new way for everyone to experience Earth data.

---

## 📸 Preview

\<!-- Replace the placeholder below with actual project screenshot -->

**Live Demo:** [Visit Earth Jukebox](https://aham-bhramasmi.vercel.app/)

---

## 💡 The Problem

Most Earth observation data is presented visually through maps, charts, and satellite imagery. This creates an accessibility barrier for people who are blind or have low vision.

Traditional pixel-to-sound sonification can also produce overwhelming audio experiences by converting too much information into sound at once.

Earth Jukebox addresses this by identifying the most significant changes first and transforming them into a short, meaningful musical experience.

---

## 🚀 How It Works

Earth Jukebox: Change Mode uses NASA's Earth at Night (EIC) visualization frames from 2012 and 2023.

Our system works through four main stages:

1. **Data Collection:** Uses NASA EIC night-lights visualization frames from 2012 and 2023.
2. **Computer Vision:** Aligns and normalizes the images, detects differences, divides the map into a 16×16 grid, and ranks regions by the magnitude of change.
3. **Data Sonification:** Converts the most significant changes into musical notes using the Web Audio API.
4. **Accessible Interaction:** Allows users to explore regions through keyboard controls, a sound legend, and spoken explanations.

### 🎵 Understanding the Sounds

Each sound represents a different aspect of change:

| Sound Property          | What It Represents                     |
| ----------------------- | -------------------------------------- |
| Pitch                   | Magnitude of change                    |
| Bright triangle tone    | Increase in night-time lights          |
| Darker, lower sine tone | Decrease in night-time lights          |
| Stereo position         | Geographic direction from west to east |
| Playback order          | Largest changes first                  |

The musical output is deterministic: the same input data produces the same composition.

---

## ✨ Features

- 🎧 **Musical Data Sonification:** Experience satellite data through dynamically generated music.
- 🧠 **Computer Vision:** Identifies and prioritizes significant changes instead of sonifying every pixel.
- ⌨️ **Keyboard-First Navigation:** Explore the experience without depending on a mouse.
- 🔊 **Sound Legend:** Listen to examples of small, medium, and large changes.
- 🗣️ **Spoken Explanations:** Hear explanations of individual regions.
- ♿ **Accessibility-Focused Design:** Built with blind and low-vision users in mind.
- 🌐 **Browser-Based Experience:** Runs directly in the browser without requiring installation.
- 📊 **Self-Check Table:** Inspect the computed notes and their corresponding data mappings.

---

## 🛠️ Tech Stack

- **JavaScript:** Core application logic.
- **React:** User interface development.
- **Vite:** Development environment and build tool.
- **Web Audio API:** Real-time audio generation and spatial sound.
- **Three.js:** 3D graphics and visualization (where applicable).
- **Computer Vision:** Image alignment, normalization, and change detection.

---

## ⌨️ Keyboard Controls

| Key     | Action                           |
| ------- | -------------------------------- |
| `Space` | Play the musical composition     |
| `← / →` | Navigate between changed regions |
| `L`     | Play the sound legend            |
| `E`     | Hear a spoken explanation        |
| `S`     | Stop playback                    |

---

## 🎯 Our Mission

We believe scientific discoveries should be accessible to everyone, regardless of how they interact with information.

Earth Jukebox aims to make satellite data more inclusive by turning complex visual information into an experience that can be heard, explored, and understood.

---

## ⚠️ Data & Limitations

- The project uses NASA EIC visualization frames, not raw satellite measurements.
- Change magnitudes are relative to the largest detected change in the selected data.
- The musical representation is an interpretation of the visualization, not a direct scientific measurement.
- The prototype has not yet been validated through controlled testing with blind and low-vision users.

We are actively seeking feedback to improve accessibility, usability, and the overall experience.

---

## 🤝 Feedback & Contributions

We welcome feedback, suggestions, and contributions.

If you encounter accessibility issues, have ideas for improvement, or would like to contribute to the project, feel free to open an issue or submit a pull request.

We are especially interested in feedback from blind and low-vision users, accessibility researchers, and developers working with data sonification.

[Feedback Form](https://forms.gle/GLLUH9Xqfxu6byCq6)

---

## 🔮 Future Roadmap

- [ ] Conduct usability testing with blind and low-vision users.
- [ ] Introduce region-based exploration (world → region → detail).
- [ ] Support additional NASA EIC datasets, including lightning.
- [ ] Improve sound mappings and accessibility controls.
- [ ] Expand the range of datasets available for sonification.

---

## 👥 Team

Built with curiosity, creativity, and the belief that data should be experienced by everyone.

**Project:** Earth Jukebox: Change Mode

**Tagline:** Hear how the Earth changes, one note at a time.
