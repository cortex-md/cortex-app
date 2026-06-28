export {
	resolveAuthorConfig,
	resolveCurrentPropertyActor,
	resolvePropertyActorValue,
} from "./actors"
export {
	changePropertyType,
	createPropertyDefinition,
	createPropertyKey,
	createPropertyOption,
	defineProperty,
	duplicatePropertyDefinition,
	getSortedPropertyOptions,
	isPropertyDefinitionEditable,
	removePropertyOption,
	setDefaultPropertyOption,
	updatePropertyOption,
	validateVaultSchema,
} from "./definitions"
export { getObservedPropertyDefinitions } from "./discovery/observed"
export {
	invalidatePropertySuggestions,
	suggestProperties,
} from "./discovery/suggestions"
export {
	extractFrontmatterBody,
	FrontmatterParseError,
	locateFrontmatter,
	parseFrontmatter,
	parseYamlMapping,
	projectRawNote,
	type RawNoteProjection,
	removeFrontmatterValue,
	replaceFrontmatterBody,
	serializeFrontmatter,
	setFrontmatterValue,
} from "./frontmatter"
export {
	getPropertyMap,
	loadNotePropertiesSnapshot,
	removeProperty,
	setProperty,
} from "./noteStore"
export {
	getPropertyType,
	getPropertyTypes,
	registerPropertyType,
	resetCustomPropertyTypes,
} from "./registry"
export {
	getOptionalPropertiesRuntime,
	getPropertiesRuntime,
	initializeProperties,
	resetPropertiesRuntime,
} from "./runtime"
export {
	getVaultSchema,
	notifyVaultSchemaChanged,
	onVaultSchemaChange,
	updateVaultSchema,
} from "./schemaStore"
export {
	createNoteWithPropertyDefaults,
	prepareDuplicatedNote,
	prepareNoteForSave,
} from "./system"
export type {
	BuiltInPropertyType,
	CreatePropertyDefinitionInput,
	CustomPropertyType,
	FrontmatterEditorState,
	FrontmatterExtensionOptions,
	FrontmatterLocation,
	FrontmatterResult,
	NotePropertiesSnapshot,
	NotePropertiesUiState,
	NoteSourceMetadata,
	PrimitivePropertyType,
	PropertiesFileService,
	PropertiesIdentityService,
	PropertiesMetadataService,
	PropertiesNoteService,
	PropertiesRuntime,
	PropertyAuthorContext,
	PropertyColor,
	PropertyDefinition,
	PropertyDevice,
	PropertyFactoryOptions,
	PropertyMap,
	PropertyOption,
	PropertyPerson,
	PropertyTypeDefinition,
	PropertyValidationResult,
	ResolvedAuthorConfig,
	ResolvedPropertyActor,
	VaultSchema,
} from "./types"
export {
	BUILT_IN_PROPERTY_TYPES,
	PROPERTY_COLORS,
} from "./types"
export {
	getNotePropertiesExpanded,
	removeNotePropertiesUiState,
	renameNotePropertiesUiState,
	setNotePropertiesExpanded,
} from "./uiState"
export {
	isEmptyPropertyValue,
	isResolvedPropertyActor,
	parsePropertyDate,
	parsePropertyInput,
	resolvePropertyOption,
	serializePropertyDate,
} from "./values"
