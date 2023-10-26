import Experience from 'webgl/Experience.js'
import fragmentShader from './PixelSorter.frag'
import vertexShader from './PixelSorter.vert'
import { Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import initDebug from './PixelSorter.debug.js'
import { PARAMS, state } from './PixelSorter.state.js'
import initGPUCompute from 'components/PixelSorter/PixelSorter.fbo.js'
import { power4In } from 'utils/Ease.js'

export default class PixelSorter {
	constructor(position = new Vector3(0, 0, 0)) {
		this.experience = new Experience()
		this.scene = this.experience.scene
		this.seedManager = this.experience.seedManager
		const seed = this.seedManager.getUrlSeed()

		this.position = position
		this.timeElapsed = 0
		this.thresholdProgress = 0
		this.thresholdMin = 0.15 - (seed % 10) * 0.01
		this.thresholdProgressMaxDuration = 5000 + (seed % 10) * 1000
		PARAMS.image = this.experience.resources.items[`image${(seed % 10) + 1}Texture`].image
		PARAMS.mask = this.experience.resources.items[`mask${(seed ** 2 % 10) + 1}Texture`]

		this.setGeometry()
		this.setMaterial()
		this.setMesh()
		initGPUCompute(PARAMS.image, PARAMS.size)
		initDebug()

		this.seedManager.on('reload', () => {
			this.timeElapsed = 0

			const seed = this.seedManager.getUrlSeed()
			PARAMS.image = this.experience.resources.items[`image${(seed % 10) + 1}Texture`].image
			PARAMS.mask = this.experience.resources.items[`mask${(seed ** 2 % 10) + 1}Texture`]
			this.thresholdProgressMaxDuration = 1000 + (seed % 10) * 1000
			this.thresholdMin = 0.15 - (seed % 10) * 0.01

			//DirectionSeed
			const x = (seed % 3) - 1
			const y = (Math.floor(seed / 3) % 3) - 1
			PARAMS.direction = { x, y }
			if (x === 0 && y === 0) PARAMS.direction = { x: 1, y: 0 }
			if (!(x === 0 || y === 0)) PARAMS.direction = { x: 0, y: 1 }

			initGPUCompute(PARAMS.image, PARAMS.size, true)
			if (this.experience.debug.active) this.experience.debug.ui.refresh()
		})
	}

	setGeometry() {
		state.geometry = new PlaneGeometry(3, 2)
	}

	setMaterial() {
		state.material = new ShaderMaterial({
			fragmentShader,
			vertexShader,
			uniforms: {
				uTexture: { value: null },
				uTextureRatio: { value: PARAMS.image.width / PARAMS.image.height },
			},
		})
	}

	setMesh() {
		state.mesh = new Mesh(state.geometry, state.material)
		state.mesh.position.copy(this.position)
		state.mesh.name = 'PixelSorter'
		this.scene.add(state.mesh)
	}

	update() {
		if (!state.variableSorted) return

		state.gpuCompute.compute()
		const { uTexture } = state.material.uniforms
		uTexture.value = state.gpuCompute.getCurrentRenderTarget(state.variableSorted).texture

		const { uThreshold, uDirection, uIteration } = state.variableSorted.material.uniforms

		if (this.experience.time.delta < 100) this.timeElapsed += this.experience.time.delta
		this.thresholdProgress = this.timeElapsed / this.thresholdProgressMaxDuration
		if (this.thresholdProgress < 1) {
			PARAMS.threshold = power4In(1 - this.thresholdProgress) * (1 - this.thresholdMin) + this.thresholdMin
			if (this.experience.debug.active) this.experience.debug.ui.refresh()
		}

		uThreshold.value = PARAMS.threshold
		uDirection.value = PARAMS.direction
		uIteration.value += 1
	}
}
