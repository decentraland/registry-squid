import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, OneToMany as OneToMany_, Relation as Relation_} from "@subsquid/typeorm-store"
import {Receipt} from "./receipt.model"

@Entity_()
export class Curation {
    constructor(props?: Partial<Curation>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    qty!: bigint

    @OneToMany_(() => Receipt, e => e.curation)
    receipts!: Relation_<Receipt[]>
}
