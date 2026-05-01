import { State, setState } from './StateManager.js';

export class DishManager {
  constructor(preloadQueue, placedGroup) {
    this.queue = preloadQueue;
    this.placedGroup = placedGroup;
    this.currentModel = null;
    
    this.queue.onLoadComplete = (dishId, model) => {
      if (State.activeDishId === dishId && !this.currentModel) {
        this.displayModel(model);
      }
    };
  }

  updatePriorities() {
    const { menuItems, currentDishIndex } = State;
    if (!menuItems || menuItems.length === 0) return;

    const currentDish = menuItems[currentDishIndex];
    const nextDish1 = menuItems[(currentDishIndex + 1) % menuItems.length];
    const nextDish2 = menuItems[(currentDishIndex + 2) % menuItems.length];
    const prevDish = menuItems[(currentDishIndex - 1 + menuItems.length) % menuItems.length];

    // Keep memory clean: Only keep current, prev, next
    const toKeep = new Set([currentDish.id, nextDish1.id, prevDish.id]);
    this.disposeOthers(toKeep);

    // Queue current dish and adjacent dishes with high priority
    if (currentDish.hasAR) this.queue.enqueue(currentDish, 'high');
    if (nextDish1.hasAR) this.queue.enqueue(nextDish1, 'high');
    if (nextDish2.hasAR) this.queue.enqueue(nextDish2, 'high');
    if (prevDish.hasAR) this.queue.enqueue(prevDish, 'high');

    // Queue rest as low priority
    menuItems.forEach(item => {
      if (item.hasAR && !toKeep.has(item.id) && item.id !== nextDish2.id) {
        this.queue.enqueue(item, 'low');
      }
    });
  }

  disposeOthers(toKeepIds) {
    const loaded = new Map(State.loadedDishes);
    let changed = false;
    for (const [id, model] of loaded.entries()) {
      if (!toKeepIds.has(id)) {
        model.traverse(child => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
        loaded.delete(id);
        changed = true;
      }
    }
    if (changed) setState({ loadedDishes: loaded });
  }

  switchDish(index, animationDir = 0) {
    const { menuItems } = State;
    if (index < 0 || index >= menuItems.length) return;
    
    const dish = menuItems[index];
    setState({ currentDishIndex: index, activeDishId: dish.id });
    
    this.updatePriorities();

    const newModel = State.loadedDishes.get(dish.id);
    
    if (this.currentModel) {
      // Fade out -> swap -> fade in (scale 0.9 -> 1)
      this.animateTransition(this.currentModel, newModel, animationDir);
    } else if (newModel) {
      this.displayModel(newModel);
    }
  }

  displayModel(model) {
    if (this.currentModel) {
      this.placedGroup.remove(this.currentModel);
    }
    this.currentModel = model;
    this.currentModel.scale.setScalar(this.currentModel.scale.x * 0.9); // Start slightly scaled down
    this.placedGroup.add(this.currentModel);
    this.placedGroup.visible = true;
    
    // Scale up animation
    this.animateScaleIn(this.currentModel);
  }

  animateTransition(oldModel, newModel, dir) {
    // Basic transition: immediately swap, then scale up
    // Ideally we would use GSAP or TWEEN, but here we can just use requestAnimationFrame
    this.placedGroup.remove(oldModel);
    if (newModel) {
      this.currentModel = newModel;
      this.currentModel.scale.setScalar(this.currentModel.scale.x * 0.9);
      this.placedGroup.add(this.currentModel);
      this.animateScaleIn(this.currentModel);
    } else {
      this.currentModel = null;
    }
  }

  animateScaleIn(model) {
    let start = performance.now();
    const duration = 300;
    const targetScale = model.scale.x / 0.9;
    const initialScale = model.scale.x;

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3);
      model.scale.setScalar(initialScale + (targetScale - initialScale) * ease);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
