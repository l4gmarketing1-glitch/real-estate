(() => {
  const { scenes, gallery, listing } = window.VILA;
  document.querySelectorAll('.listing-link').forEach(a => a.href = listing);
  const mobileMenu = document.querySelector('#mobile-menu');
  const menuButton = document.querySelector('.menu-button');
  menuButton.onclick = () => {
    mobileMenu.hidden = !mobileMenu.hidden;
    menuButton.setAttribute('aria-expanded', String(!mobileMenu.hidden));
    menuButton.setAttribute('aria-label', mobileMenu.hidden ? 'Deschide meniul' : 'Închide meniul');
  };
  mobileMenu.querySelectorAll('a').forEach(a => a.onclick = () => { mobileMenu.hidden = true; menuButton.setAttribute('aria-expanded','false'); });
  const motionButton = document.querySelector('#motion-toggle');
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setMotion() {
    document.body.classList.toggle('reduced-motion', reduced);
    motionButton.setAttribute('aria-pressed', String(reduced));
    motionButton.textContent = reduced ? 'Activează animațiile' : 'Oprește animațiile';
  }
  setMotion();
  motionButton.onclick = () => { reduced = !reduced; setMotion(); schedule(); };
  const media = document.querySelector('#tour-media');
  const nav = document.querySelector('#chapter-nav');
  const steps = document.querySelector('#tour-steps');
  const tour = document.querySelector('.walkthrough');
  const copy = document.querySelector('#tour-copy');
  const counter = document.querySelector('#tour-counter');
  let active = -1;
  scenes.forEach((scene, index) => {
    const img = document.createElement('img');
    img.className = 'scene-media'; img.src = `assets/${scene.image}`; img.alt = scene.label;
    img.loading = 'lazy'; img.decoding = 'async'; media.append(img);
    const button = document.createElement('button');
    button.innerHTML = `<span>${scene.label}</span><i aria-hidden="true"></i>`;
    button.setAttribute('aria-label', `Explorer : ${scene.label}`);
    button.onclick = () => {
      const start = tour.getBoundingClientRect().top + window.scrollY;
      const range = tour.offsetHeight - innerHeight;
      window.scrollTo({ top: start + range * (index + 0.08) / scenes.length, behavior: reduced ? 'instant' : 'smooth' });
    };
    nav.append(button);
    const step = document.createElement('div'); step.className = 'tour-step'; step.id = `scene-${scene.id}`; steps.append(step);
  });
  const images = [...media.children], buttons = [...nav.children];
  let ticking = false;
  function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(updateTour); } }
  function updateTour() {
    ticking = false;
    const box = tour.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, -box.top / (tour.offsetHeight - innerHeight)));
    const position = progress * scenes.length;
    const index = Math.min(scenes.length - 1, Math.floor(position));
    const local = position - index;
    if (active !== index) {
      active = index;
      const scene = scenes[index];
      copy.innerHTML = `<p class="eyebrow">${scene.eyebrow}</p><h3>${scene.title}</h3><p>${scene.text}</p><button>Vezi fotografia</button>`;
      copy.querySelector('button').onclick = () => openImage(scene.gallery);
      counter.textContent = `${String(index+1).padStart(2,'0')} / 07`;
      buttons.forEach((button, i) => { button.classList.toggle('active',i===index); button.setAttribute('aria-current',i===index ? 'step' : 'false'); });
      images.forEach((image, i) => { image.style.opacity = i === index ? 1 : 0; image.classList.toggle('active',i===index); });
    }
    const current = images[index];
    current.style.transform = reduced ? 'none' : `scale(${1.02 + Math.min(local,1) * .07})`;
    // A short photographic dissolve between rooms; videos can replace these via media.json.
    if (!reduced && local > .78 && index < scenes.length - 1) {
      const fade = (local-.78)/.22;
      images[index+1].style.opacity = fade;
      images[index+1].style.transform = 'scale(1.02)';
    } else if(index < scenes.length - 1) images[index+1].style.opacity = 0;
    document.querySelector('#tour-progress-bar').style.width = `${progress*100}%`;
    updateVideo(index, local, box.top <= 0 && box.bottom >= 0);
  }
  addEventListener('scroll',schedule,{passive:true}); addEventListener('resize',schedule); schedule();
  const grid = document.querySelector('#gallery-grid');
  function renderGallery(filter) {
    grid.replaceChildren();
    gallery.forEach((photo,index) => {
      if(filter !== 'all' && filter !== photo.category) return;
      const card = document.createElement('button'); card.className = 'gallery-card';
      card.setAttribute('aria-label', `Mărește fotografia: ${photo.label}`);
      const wrap = document.createElement('div'); wrap.className = 'image-wrap';
      const img = document.createElement('img'); img.src = `assets/${photo.file}`; img.alt = photo.label; img.loading = 'lazy';
      const text = document.createElement('span'); text.textContent = photo.label;
      wrap.append(img); card.append(wrap,text); card.onclick = () => openImage(index); grid.append(card);
    });
  }
  renderGallery('all');
  document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => {
    document.querySelectorAll('[data-filter]').forEach(b => { b.classList.toggle('active',b===button); b.setAttribute('aria-pressed',String(b===button)); });
    renderGallery(button.dataset.filter);
  });
  const dialog = document.querySelector('#lightbox'); let photoIndex = 0;
  function showImage() {
    const photo = gallery[photoIndex]; const img = document.querySelector('#lightbox-image');
    img.src = `assets/${photo.file}`; img.alt = photo.label;
    document.querySelector('#lightbox-caption').textContent = photo.label;
    document.querySelector('#lightbox-count').textContent = `${photoIndex+1} / ${gallery.length}`;
  }
  function openImage(index) { photoIndex = index; showImage(); if(!dialog.open) dialog.showModal(); document.body.classList.add('modal-open'); }
  function changeImage(delta) { photoIndex = (photoIndex + delta + gallery.length) % gallery.length; showImage(); }
  document.querySelector('#lightbox-close').onclick = () => dialog.close();
  document.querySelector('.lightbox-prev').onclick = () => changeImage(-1);
  document.querySelector('.lightbox-next').onclick = () => changeImage(1);
  dialog.addEventListener('close',() => document.body.classList.remove('modal-open'));
  dialog.addEventListener('keydown',e => { if(e.key==='ArrowLeft')changeImage(-1); if(e.key==='ArrowRight')changeImage(1); });
  let touchX = 0;
  dialog.addEventListener('touchstart',e => touchX=e.changedTouches[0].clientX,{passive:true});
  dialog.addEventListener('touchend',e => {const dx=e.changedTouches[0].clientX-touchX;if(Math.abs(dx)>60)changeImage(dx>0?-1:1);},{passive:true});
  // Optional Higgsfield video clips are loaded only when a local manifest exists.
  // Each clip must be reviewed against the original property photograph first.
  let clips = {}; let video = null; let videoScene = '';
  fetch('media.json').then(r => r.ok ? r.json() : {}).then(data => { clips=data; schedule(); }).catch(()=>{});
  function updateVideo(index,local,inView) {
    if(!clips) return;
    const clip=clips[scenes[index].id];
    if(reduced || !clip || !inView) {if(video){video.style.opacity=0;video.pause();}return;}
    if(!video) {video=document.createElement('video');video.className='scene-media';video.muted=true;video.playsInline=true;video.preload='metadata';media.append(video);}
    if(videoScene!==scenes[index].id) {videoScene=scenes[index].id;video.src=clip;video.style.opacity=0;video.load();}
    if(Number.isFinite(video.duration) && video.readyState>=2) {
      video.style.opacity=local>.82 ? Math.max(0,(1-local)/.18) : 1;
      const target=Math.min(video.duration-.04,Math.max(0,local)*video.duration);
      if(!video.seeking && Math.abs(video.currentTime-target)>.08)video.currentTime=target;
    }
  }
})();
